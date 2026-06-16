# Vigilo Benchmark Methodology

Vigilo's benchmark harness measures how well Vigilo's audit findings recover the **verified, paid-out vulnerabilities** from real competitive audit contests. It is not a synthetic challenge suite and it does not produce a single headline "pass rate" — it scores Vigilo's findings against published ground-truth reports and reports detection, precision, and related metrics per contest.

The harness lives in [`packages/bench`](../packages/bench). See its [README](../packages/bench/README.md) for the canonical command reference.

> **Status:** No suite-level numbers are published in this repository. The result tables below are templates — run the harness to populate them. Every cell marked `—` must be filled from an actual scoring run, never estimated or copied.

---

## Ground Truth

The dataset is drawn from [ScaBench](https://github.com/NethermindEth/ScaBench) and consists of real audit contests whose findings were judged and rewarded by the hosting platform. Each contest contributes its set of confirmed vulnerabilities as the ground truth against which Vigilo is scored.

| Platform | Contests in dataset |
|----------|---------------------|
| Code4rena | 19 |
| Sherlock | 10 |
| Cantina | 2 |
| **Total** | **31** |

The dataset and the per-contest registry are stored under [`packages/bench/data`](../packages/bench/data):

- `dataset.json` — the full ScaBench corpus: each project's `repo`, `commit`, and verified `vulnerabilities` (the ground truth).
- `contests.json` — the local run registry tracking each contest's `status` (`pending` → `audited` → `scored` / `baseline-scored`) and `lastRun`.
- `baselines/` — precomputed baseline-model findings (one JSON per contest) used for head-to-head baseline scoring.

```bash
# List the available contests
cat packages/bench/data/dataset.json | jq -r '.[].project_id'
```

Use only contests that exist in `dataset.json`. Do not invent contest names.

---

## Pipeline

The full pipeline runs four stages in order. Each stage is also runnable on its own.

```
checkout  →  audit  →  score  →  report
```

1. **Checkout** — clone the contest's source at its pinned commit and extract the contest's verified vulnerabilities as ground truth.
2. **Audit** — run Vigilo against the checked-out source, producing findings under the project's `.vigilo/` directory.
3. **Score** — match Vigilo's findings against the ground truth with the LLM judge (see below) and compute metrics.
4. **Report** — render the scored results as Markdown.

```bash
# Full pipeline: checkout → audit → score → report
bunx vigilo-bench <contest-id> -w -v

# Individual stages
bunx vigilo-bench checkout <contest-id>
bunx vigilo-bench score <contest-id> -v
bunx vigilo-bench score-baseline <contest-id> -v
bunx vigilo-bench report --contest <contest-id>
```

| Flag | Description |
|------|-------------|
| `-v` | Verbose output (per-finding judge votes and explanations) |
| `-w` | Watch mode (opens the OpenCode TUI to debug the audit) |
| `--skip-audit` | Reuse existing findings in `.vigilo/` instead of re-auditing |
| `--iterations <n>` | Number of judge iterations per match (default 3) |

The scoring model is configurable via the `BENCH_MODEL` environment variable.

---

## Scoring Algorithm

Scoring is an **LLM-as-judge** process implemented in [`src/scorer/llm-scorer.ts`](../packages/bench/src/scorer/llm-scorer.ts). It performs per-truth root-cause matching rather than string comparison, so a finding counts only when it identifies the *same underlying vulnerability* as the ground truth.

For each ground-truth vulnerability, in order:

1. **Batch the candidates.** Vigilo's findings are split into batches (default 5) and presented to the judge alongside the ground-truth issue.
2. **Majority voting.** The judge is queried up to 3 times (`--iterations`). Each call votes `EXACT`, `PARTIAL`, or `NONE`. The harness takes a majority and short-circuits as soon as two votes agree (early consensus). A 1/1/1 split resolves to `PARTIAL`.
3. **Greedy de-duplication.** Once a Vigilo finding is matched to a ground-truth item, it is removed from the working set so it cannot be double-counted against a second truth.
4. **Prefer exact.** The matcher keeps searching subsequent batches for an `EXACT` match before settling for the best `PARTIAL` it has seen.

Findings that never match any ground truth (excluding informational severity) are recorded as **false positives**.

### Match Types

| Match | Meaning |
|-------|---------|
| **Exact** | Same root cause, attack scenario, and impact as the ground truth. |
| **Partial** | Same root cause, but incomplete scenario or impact. |
| **None** | No Vigilo finding corresponds to this ground-truth vulnerability. |

---

## Metrics

The scorer emits a `ScoreResult` per contest (see [`src/types.ts`](../packages/bench/src/types.ts)). The core fields:

| Field | Definition |
|-------|------------|
| `total_truth` | Number of verified ground-truth vulnerabilities in the contest. |
| `exact_matches` | Ground-truth items matched `EXACT`. |
| `partial_matches` | Ground-truth items matched `PARTIAL`. |
| `missed` | Ground-truth items with no matching finding. |
| `total_findings` | Total findings Vigilo reported. |
| `false_positives` | Non-informational findings that matched no ground truth. |
| `detection_rate` | `exact_matches / total_truth` (recall on exact matches). |
| `partial_rate` | `(exact_matches + partial_matches) / total_truth`. |
| `precision` | `exact_matches / (exact_matches + false_positives)`. |
| `recall` | Same as `detection_rate`. |
| `f1_score` | Harmonic mean of precision and recall. |
| `severity_weighted_score` | Detection weighted by severity (critical 5, high 4, medium 2, low 1; partials count half). |
| `per_severity` | Per-severity breakdown (`critical` / `high` / `medium` / `low`) of total, exact, partial, missed, and rates. |
| `vuln_type_breakdown` | Per-auditor breakdown of findings, matches, and detection rate. |

---

## Baseline Comparison

A baseline model can be scored against the same ground truth using the identical matching logic ([`src/scorer/baseline-scorer.ts`](../packages/bench/src/scorer/baseline-scorer.ts)), so Vigilo and the baseline are judged on equal terms (same prompt, same 3-iteration majority voting). Precomputed baselines live in `packages/bench/data/baselines/`.

```bash
# Score the baseline once per contest
bunx vigilo-bench score-baseline <contest-id> -v

# Then a normal run shows the Vigilo-vs-baseline delta
bunx vigilo-bench <contest-id> -v
```

When a baseline has been scored, the `ScoreResult` carries a `baseline_comparison` block (baseline detection rate, whether Vigilo did `better`/`worse`/`equal`, and the detection-rate delta).

---

## Results

Results are produced by running the harness; **no suite-level numbers are published in this repository yet.** Run `score` (and optionally `score-baseline`) on the contests you care about, then `report` to render them. The tables below are templates — fill each cell from an actual run.

### Per-contest

| Contest ID | `total_truth` | Exact | Partial | Missed | False positives | Detection rate | Precision | F1 |
|------------|---------------|-------|---------|--------|-----------------|----------------|-----------|----|
| _(run to populate)_ | — | — | — | — | — | — | — | — |

### Per-severity (single contest)

| Severity | Total | Exact | Partial | Missed | Detection rate | Partial rate |
|----------|-------|-------|---------|--------|----------------|--------------|
| Critical | — | — | — | — | — | — |
| High | — | — | — | — | — | — |
| Medium | — | — | — | — | — | — |
| Low | — | — | — | — | — | — |

### Vigilo vs baseline (single contest)

| Metric | Vigilo | Baseline (`BENCH_MODEL`) | Delta |
|--------|--------|--------------------------|-------|
| Detection rate | — | — | — |
| Exact matches | — | — | — |

---

## Reproducing a Run

```bash
# 1. Pick a contest that exists in the dataset
cat packages/bench/data/dataset.json | jq -r '.[].project_id'

# 2. Run the full pipeline (clone → audit → score → report)
bunx vigilo-bench <contest-id> -v

# 3. (Optional) score the baseline for a head-to-head delta
bunx vigilo-bench score-baseline <contest-id> -v

# 4. Render the report
bunx vigilo-bench report --contest <contest-id>
```

Scores depend on the audit model, the scoring model (`BENCH_MODEL`), and the iteration count, so record those alongside any numbers you publish.

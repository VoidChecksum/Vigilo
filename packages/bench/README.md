# Vigilo Bench

Benchmark Vigilo's audit accuracy against Code4rena, Sherlock, and Cantina ground truth reports.

## Quick Start

```bash
# Full pipeline: checkout → audit → score → report
bunx vigilo-bench sherlock_cork-protocol_2025_01 -w -v
```

| Flag | Description |
|------|-------------|
| `-v` | Verbose output |
| `-w` | Watch mode (opens OpenCode TUI) |
| `--skip-audit` | Skip audit, use existing `.vigilo/` |

## Commands

### Full Pipeline

```bash
bunx vigilo-bench <contest-id> [options]
```

### Individual Steps

```bash
# 1. Clone source code + extract ground truth
bunx vigilo-bench checkout <contest-id>

# 2. Score Vigilo findings against ground truth
bunx vigilo-bench score <contest-id> -v

# 3. Score baseline (GPT-5) against ground truth
bunx vigilo-bench score-baseline <contest-id> -v

# 4. Generate markdown report
bunx vigilo-bench report --contest <contest-id>
```

## Baseline Comparison

Compare Vigilo's performance against GPT-5 baseline:

```bash
# Step 1: Score the baseline (one-time setup per contest)
bunx vigilo-bench score-baseline sherlock_cork-protocol_2025_01 -v

# Step 2: Run benchmark (now shows real baseline comparison)
bunx vigilo-bench sherlock_cork-protocol_2025_01 -w -v
```

**Output:**
```
=== Scoring Complete ===
Exact matches:   3/7
Partial matches: 2/7
Missed:          2/7
False positives: 12

Detection rate:  42.9%
Precision:       20.0%
F1 Score:        28.6%

vs Baseline (gpt-5): BETTER (+15.2%)
```

## Scoring Metrics

| Metric | Formula |
|--------|---------|
| **Detection Rate** | Exact matches / Ground truth count |
| **Partial Rate** | (Exact + Partial) / Ground truth count |
| **Precision** | Exact matches / (Exact + False positives) |
| **F1 Score** | 2 × (Precision × Recall) / (Precision + Recall) |

**Match Types:**
- **Exact**: Same root cause + attack scenario + impact
- **Partial**: Same root cause, incomplete scenario/impact
- **None**: No matching vulnerability found

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `BENCH_MODEL` | `anthropic/claude-opus-4-5` | LLM for scoring |

## Available Contests

31 contests from [ScaBench](https://github.com/NethermindEth/ScaBench):

```bash
# List all contests
cat packages/bench/data/dataset.json | jq -r '.[].project_id'
```

**Platforms:** Code4rena, Sherlock, Cantina

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Audit not starting | Run with `-w` flag to debug in TUI |
| LLM parsing failed | Increase iterations: `--iterations 5` |
| No findings | Check Vigilo installation: `bunx vigilo doctor` |

## License

[BSL-1.1](../../LICENSE)

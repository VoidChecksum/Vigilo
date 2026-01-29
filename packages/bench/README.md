# Vigilo Bench

Benchmark system for measuring Vigilo audit accuracy against Code4rena/Cantina/Sherlock verified security reports (Ground Truth).

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Vigilo Bench Pipeline                       │
├─────────────────────────────────────────────────────────────────┤
│         checkout  →  audit  →  score  →  report                 │
│                                                                 │
│         ScaBench     Vigilo     LLM        Markdown             │
│         Dataset      Audit      Scoring    Report               │
└─────────────────────────────────────────────────────────────────┘
```

**Scoring Algorithm**: Based on [Nethermind AuditAgent](https://github.com/NethermindEth/auditagent-scoring-algo)
- Iterates through Ground Truth vulnerabilities one by one
- Compares each vulnerability against batches of Vigilo findings via LLM
- Uses 3 iterations + majority voting for reliable results

## Prerequisites

- [OpenCode](https://github.com/anomalyco/opencode) with Vigilo installed
- Git

## Installation

```bash
# Run directly (recommended)
bunx vigilo-bench <contest-id>

# Or install globally
bun add -g vigilo-bench
```

## Quick Start

**One command runs the full pipeline:**

```bash
bunx vigilo-bench <contest-id> [options]
```

**Examples:**

```bash
# Full pipeline with watch mode (see audit in OpenCode TUI)
bunx vigilo-bench sherlock_cork-protocol_2025_01 -w -v

# Headless mode (automated)
bunx vigilo-bench code4rena_loopfi_2025_02

# Skip audit (use existing .vigilo/)
bunx vigilo-bench code4rena_loopfi_2025_02 --skip-audit -v
```

**Options:**

| Flag | Description |
|------|-------------|
| `-v, --verbose` | Show detailed output (LLM responses, batch processing) |
| `-w, --watch` | Open OpenCode TUI to watch audit progress |
| `--skip-audit` | Skip audit step (use existing .vigilo/) |

## Pipeline Steps

When you run `bunx vigilo-bench <contest-id>`:

1. **Checkout** - Clone source code from ScaBench dataset + extract ground truth
2. **Audit** - Run Vigilo audit (headless or watch mode)
3. **Score** - Compare findings against ground truth using LLM
4. **Report** - Generate markdown benchmark report

## Individual Commands

For manual control, you can run each step separately:

### `checkout <contest-id>`

Clone contest source code and extract ground truth.

```bash
bunx vigilo-bench checkout code4rena_loopfi_2025_02
```

### `score <contest-id>`

Score findings against ground truth.

```bash
bunx vigilo-bench score code4rena_loopfi_2025_02 -v
bunx vigilo-bench score code4rena_loopfi_2025_02 --iterations 5 --batch-size 5
```

**Options:**
- `-v, --verbose` - Detailed logging
- `--iterations <n>` - LLM iterations for majority voting (default: 3)
- `--batch-size <n>` - Findings per batch (default: 10)

**Environment Variables:**
- `BENCH_MODEL` - Model to use (default: `anthropic/claude-opus-4-5`)

### `report`

Generate markdown reports.

```bash
bunx vigilo-bench report --contest code4rena_loopfi_2025_02
bunx vigilo-bench report --all
```

## Data Structure

```
packages/bench/
├── src/
│   ├── cli.ts
│   ├── client/
│   │   └── opencode.ts
│   ├── commands/
│   │   ├── pipeline.ts
│   │   ├── checkout.ts
│   │   ├── score.ts
│   │   └── report.ts
│   ├── scorer/
│   │   ├── llm-scorer.ts
│   │   └── prompts.ts
│   └── parsers/
│       └── vigilo-findings.ts
└── data/
    ├── dataset.json           # ScaBench dataset (31 contests)
    ├── baselines/             # GPT-5 baseline results
    ├── sources/               # Cloned source code + .vigilo/
    │   └── {contest-id}/
    │       └── .vigilo/findings/
    ├── truth/                 # Ground truth JSON
    │   └── {contest-id}.json
    ├── scores/                # Scoring results
    │   └── {contest-id}/
    │       └── {timestamp}.json
    └── reports/               # Generated markdown reports
        └── {contest-id}.md
```

## Scoring Methodology

### Match Types

| Type | Condition |
|------|-----------|
| **Exact Match** | Same Root Cause + Attack Scenario + Impact |
| **Partial Match** | Same Root Cause, incomplete scenario/impact |
| **No Match** | No matching finding found |

### Metrics

| Metric | Description |
|--------|-------------|
| **Detection Rate** | Exact matches / Total ground truth |
| **Partial Rate** | (Exact + Partial) / Total ground truth |
| **Precision** | Exact matches / (Exact + False positives) |
| **F1 Score** | 2 × (Precision × Recall) / (Precision + Recall) |
| **Severity-Weighted** | Weighted score (Critical=5, High=4, Medium=2, Low=1) |

### Example Output

```
=== Scoring Complete ===
Exact matches:   3/7
Partial matches: 2/7
Missed:          2/7
False positives: 12

Detection rate:  42.9%
Precision:       20.0%
F1 Score:        28.6%
Severity-Weighted: 45.0%

vs Baseline (gpt-5): BETTER (+15.2%)
```

## Available Contests

31 contests from ScaBench dataset:

```bash
cat data/dataset.json | jq -r '.[] | "\(.project_id) - \(.vulnerabilities | length) vulns"' | head -10
```

| Platform | Example Contests |
|----------|------------------|
| Code4rena | loopfi, pump-science, mantra-dex |
| Sherlock | cork-protocol, perennial-v2, oku |
| Cantina | minimal-delegation |

## Troubleshooting

### Audit Not Starting

```bash
# Use watch mode to debug
bunx vigilo-bench <contest-id> -w

# Or run audit manually
cd data/sources/<contest-id>
opencode
# Then type: /audit
```

### LLM Response Parsing Failed

```
Failed to parse LLM JSON response
```

Try increasing iterations: `--iterations 5`

### No Findings Generated

Ensure Vigilo is properly installed in OpenCode:
```bash
bunx vigilo doctor
```

## License

See [LICENSE](../../LICENSE) in the root directory.

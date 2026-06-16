# Vigilo Smart Contract Audit — GitHub Action

Run an autonomous **smart contract security audit** in your CI pipeline using
[Vigilo](https://github.com/PurpleAILAB/Vigilo). The action audits
Solidity / Vyper / Cairo projects, emits **SARIF v2.1.0** results for GitHub
Code Scanning, and fails the job when findings hit a configurable severity
threshold.

## Quick start

```yaml
# In your .github/workflows/security.yml
jobs:
  audit:
    runs-on: ubuntu-latest
    permissions:
      security-events: write   # required to upload SARIF to Code Scanning
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: PurpleAILAB/Vigilo/.github/actions/vigilo-audit@main
        with:
          target: ./contracts
          fail-on: high
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Findings appear under the repository's **Security → Code scanning** tab, and the
job fails if any finding is at or above the `fail-on` severity.

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `target` | Target directory to audit (relative to the repo root). | `./` |
| `scan-mode` | Audit depth: `quick` \| `standard` \| `deep`. | `standard` |
| `scope-mode` | `full` (whole target) or `diff` (changed files only). | `full` |
| `diff-base` | Git ref to diff against when `scope-mode: diff`. | `origin/main` |
| `fail-on` | Minimum severity that fails the job: `critical` \| `high` \| `medium` \| `low` \| `none`. | `high` |
| `sarif-output` | Path for the generated SARIF file. | `vigilo.sarif` |
| `upload-sarif` | Upload the SARIF report to GitHub Code Scanning. | `true` |
| `language` | Smart contract language: `solidity` \| `vyper` \| `cairo` \| `auto`. | `auto` |
| `framework` | Build framework: `foundry` \| `hardhat` \| `auto`. | `auto` |
| `model` | LLM model used for analysis (`provider/model`). | `anthropic/claude-sonnet-4-20250514` |

## Outputs

| Output | Description |
|--------|-------------|
| `sarif-path` | Path to the generated SARIF file. |
| `finding-count` | Total number of findings across all severities. |
| `critical-count` | Number of critical severity findings. |
| `high-count` | Number of high severity findings. |
| `medium-count` | Number of medium severity findings. |
| `exit-code` | `0` ok · `1` findings ≥ threshold · `2` error. |

A severity-count table and gate outcome are also written to the GitHub **job summary**
(`$GITHUB_STEP_SUMMARY`) on every run, and findings appear in the **Code Scanning** tab.

## Environment

The audit calls an LLM provider, so supply the matching API key as an env var.
Match the key to the provider in your `model` input:

| Provider (`model` prefix) | Required secret |
|---------------------------|-----------------|
| `anthropic/` | `ANTHROPIC_API_KEY` |
| `openai/` | `OPENAI_API_KEY` |
| `google/` | `GEMINI_API_KEY` |

## Examples

### Audit only changed contracts on a pull request

```yaml
jobs:
  audit:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: PurpleAILAB/Vigilo/.github/actions/vigilo-audit@main
        with:
          target: ./src
          scope-mode: diff
          diff-base: origin/${{ github.base_ref }}
          scan-mode: standard
          fail-on: high
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Deep audit on a schedule, never fail the job, just report

```yaml
on:
  schedule:
    - cron: "0 3 * * 1"   # weekly, Monday 03:00 UTC

jobs:
  audit:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: PurpleAILAB/Vigilo/.github/actions/vigilo-audit@main
        with:
          target: ./contracts
          scan-mode: deep
          fail-on: none          # report-only: surface findings without failing
          language: solidity
          framework: foundry
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Consume the outputs in a later step

```yaml
      - id: vigilo
        uses: PurpleAILAB/Vigilo/.github/actions/vigilo-audit@main
        with:
          target: ./contracts
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Comment summary
        run: |
          echo "Findings: ${{ steps.vigilo.outputs.finding-count }}"
          echo "High:     ${{ steps.vigilo.outputs.high-count }}"
          echo "Medium:   ${{ steps.vigilo.outputs.medium-count }}"
          echo "SARIF:    ${{ steps.vigilo.outputs.sarif-path }}"
```

## How it works

1. **Checkout** — full git history (so `diff` scope can resolve the base ref).
2. **Node.js + Vigilo** — installs Node 24 and `vigilo` / `opencode-ai` globally.
3. **Framework detection** — `foundry.toml` ⇒ Foundry (`foundryup`),
   `hardhat.config.*` ⇒ Hardhat (`npm ci`).
4. **Build** — `forge build` or `npx hardhat compile`.
5. **Audit** — registers the Vigilo plugin and runs the legion headlessly;
   findings are written to `.vigilo/findings/<severity>/*.md`.
6. **SARIF** — parses findings into SARIF v2.1.0, counting by severity.
7. **Upload** — sends the SARIF to GitHub Code Scanning (when `upload-sarif: true`).
8. **Threshold** — fails the job when any finding is at or above `fail-on`.

## Permissions

To publish results to the Security tab, the calling workflow must grant:

```yaml
permissions:
  security-events: write
  contents: read
```

If `upload-sarif: false`, only `contents: read` is required.

## Pinned dependencies

All third-party actions are pinned to a full commit SHA:

| Action | SHA |
|--------|-----|
| `actions/checkout` | `df4cb1c069e1874edd31b4311f1884172cec0e10` (v6.0.3) |
| `actions/setup-node` | `39370e3970a6d050c480ffad4ff0ed4d3fdee5af` (v4.1.0) |
| `github/codeql-action/upload-sarif` | `dd903d2e4f5405488e5ef1422510ee31c8b32357` (v3.36.2) |

## License

Part of Vigilo, licensed under the
[MIT License](https://github.com/PurpleAILAB/Vigilo/blob/main/LICENSE)
(converts to Apache-2.0 on 2029-01-21).

# Executive Summary Template

The executive summary (`.vigilo/reports/{date}_{platform}_audit.md`) is the portfolio-level
view a sponsor/lead reads first. Generate it from the **aggregated, de-duplicated, validated**
findings (after Step 2.5). Fill every placeholder; never leave `{...}` in the output.

```markdown
# Security Audit Report — {Protocol Name}

- **Auditor:** Vigilo (autonomous smart-contract audit legion)
- **Date:** {YYYY-MM-DD}
- **Scope:** {N} contracts / {LOC} lines — {commit hash or tag}
- **Methodology:** {brief — recon, specialist auditors deployed, tools, PoC validation}

## Risk Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | {n} | {validated} |
| High | {n} | {validated} |
| Medium | {n} | {validated} |
| Low | {n} | {validated} |
| Informational | {n} | — |

**Overall risk rating:** {Critical / High / Medium / Low}
{One-paragraph narrative: the most severe issues, the protocol's overall security posture,
and whether funds are at direct risk. Qualitative impact only — no dollar amounts.}

## Findings Overview

| ID | Title | Severity | `vuln_class` | Target | Status |
|----|-------|----------|--------------|--------|--------|
| H-01 | {title} | High | SWC-107 | src/Vault.sol:42 | validated |
| M-01 | {title} | Medium | CWE-1339 | src/Oracle.sol:88 | validated |
| … | | | | | |

(Each row links to its full submission report under `submissions/`.)

## Scope & Limitations

- {In-scope contracts/paths}
- {Out-of-scope items}
- {Assumptions — e.g. trusted admin, external dependency versions}
- This audit does not guarantee the absence of vulnerabilities; it reflects the issues found
  within scope and time.

## Methodology Detail

{Phases run, auditors deployed by protocol type, static tools (Slither/Semgrep) and their
consensus role, and how each finding's impact was validated with a runnable Foundry PoC.}
```

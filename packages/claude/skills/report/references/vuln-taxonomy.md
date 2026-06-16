# Vulnerability Taxonomy (for the `vuln_class` field)

Use a stable taxonomy id in each finding's `vuln_class` frontmatter so findings can be
cross-referenced (Solodit, SWC registry), aggregated by class, and de-duplicated. Prefer an
**SWC** id where one exists; otherwise use **DASP-10** or a **CWE** id. Format: `SWC-107`,
`DASP-1`, or `CWE-841`.

## Common smart-contract classes → Vigilo auditor

| Class | SWC | DASP / CWE | Vigilo auditor |
|-------|-----|------------|----------------|
| Reentrancy | SWC-107 | DASP-1 | reentrancy-auditor |
| Access control / authorization | SWC-105, SWC-106 | DASP-2 / CWE-284 | access-control-auditor |
| Arithmetic over/underflow | SWC-101 | DASP-3 | logic-auditor |
| Unchecked low-level call return | SWC-104 | DASP-4 | logic-auditor |
| Oracle / price manipulation | — | CWE-1339 | oracle-auditor |
| Flash-loan / atomic capital abuse | — | DASP-3 | flashloan-auditor |
| Bad randomness | SWC-120 | DASP-6 | logic-auditor |
| Front-running / MEV | SWC-114 | DASP-7 | defi-auditor |
| Time manipulation | SWC-116 | DASP-8 | logic-auditor |
| Denial of service | SWC-113, SWC-128 | DASP-5 | defi-auditor |
| Uninitialized / delegatecall / proxy | SWC-109, SWC-112 | CWE-665 | access-control-auditor |
| Token accounting / ERC compliance | — | CWE-682 | token-auditor |
| Cross-chain / bridge message validation | — | CWE-345 | cross-chain-auditor |
| Donation / share-inflation (ERC-4626) | — | CWE-682 | defi-auditor |

## Notes
- SWC registry: <https://swcregistry.io> · DASP-10: <https://dasp.co> · CWE: <https://cwe.mitre.org>
- When several apply, pick the most specific (e.g. prefer `SWC-107` over a generic CWE).
- The benchmark and aggregation steps group same-`vuln_class` findings on overlapping targets,
  so an accurate class directly improves de-duplication quality.

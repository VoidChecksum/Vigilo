# Documentation Reconnaissance Findings

**Generated**: {YYYY-MM-DD HH:MM}
**Project**: {project name}
**Documentation Quality**: {Excellent/Good/Adequate/Poor/Minimal}
**Protocol Type**: {AMM/Lending/Vault/Governance/Staking/Bridge}

---

## Protocol Overview

{2-3 sentences: what the protocol does, target users, primary value proposition}

---

## The 4 Essential Questions

### 1. Where Is the Money?

| Question | Answer |
|----------|--------|
| Valuable Assets | {ETH, ERC20, shares, LP tokens, etc.} |
| Storage Contracts | {contract names where assets are held} |
| TVL Mention | {documented TVL or "Not mentioned"} |

### 2. Who Can Move the Money?

| Path Type | Functions | Access |
|-----------|-----------|--------|
| Deposit | {deposit, stake, supply, mint} | {who can call} |
| Withdrawal | {withdraw, redeem, unstake, burn} | {who can call} |
| Privileged | {emergencyWithdraw, sweep, skim} | {admin only} |

### 3. Core Invariants

**Explicit** (directly stated in docs):
- {invariant 1 with source reference}
- {invariant 2 with source reference}

**Implicit** (inferred from mechanisms):
- [INFERRED] {invariant 1 - explain reasoning}
- [INFERRED] {invariant 2 - explain reasoning}

### 4. Trust Assumptions

| Entity | Trusted For | Limitations | Risk if Violated |
|--------|-------------|-------------|------------------|
| Owner | {actions} | {constraints} | {impact} |
| Admin | {actions} | {constraints} | {impact} |
| Oracle | {data provided} | {freshness, backup} | {impact} |

---

## Core Mechanisms

### {Mechanism 1 Name}

| Aspect | Description |
|--------|-------------|
| Purpose | {what it does} |
| Flow | {step by step operation} |
| Constraints | {limitations, requirements} |

### {Mechanism 2 Name}

| Aspect | Description |
|--------|-------------|
| Purpose | {what it does} |
| Flow | {step by step operation} |
| Constraints | {limitations, requirements} |

---

## Invariants (for Phase 2)

Properties that must NEVER be violated:

### Economic Invariants
- [ ] {invariant - specific and verifiable}

### State Invariants
- [ ] {invariant - specific and verifiable}

### Access Control Invariants
- [ ] {invariant - specific and verifiable}

---

## Admin Capabilities

| Capability | Constraints | Timelock | Multisig |
|------------|-------------|----------|----------|
| {capability 1} | {bounds} | {Yes/No/Unknown} | {Yes/No/Unknown} |

---

## Security Considerations

### Documented Warnings
- {warning 1 from documentation}
- {warning 2 from documentation}

### Previous Audits

| Date | Auditor | Key Findings |
|------|---------|--------------|
| {date} | {firm} | {summary} |

### Known Limitations
- {limitation 1 from docs}
- {limitation 2 from docs}

---

## Documentation Gaps

### Missing Critical Information
- {item 1 - e.g., "No explicit invariant specification"}
- {item 2 - e.g., "Admin power limits not documented"}

### Unclear or Ambiguous
- {ambiguity 1}
- {ambiguity 2}

---

## Documentation Sources

| Source | Path | Key Information |
|--------|------|-----------------|
| README | /README.md | {what was extracted} |
| Docs | /docs/... | {what was extracted} |
| Security | /SECURITY.md | {what was extracted} |

---

## Notes

{Additional context, observations, or concerns}

# Severity Classification Standards

Industry-standard severity classification for smart contract vulnerabilities.

---

## Universal Criteria

### Critical / High Severity

**Impact**: Direct loss of funds, protocol insolvency, or complete loss of access control.

| Criteria | Examples |
|----------|----------|
| **Direct fund theft** | Unauthorized withdrawal, drain attack |
| **Protocol insolvency** | Bad debt accumulation, accounting manipulation |
| **Complete access control bypass** | Anyone can call admin functions |
| **Permanent DoS** | Contract bricked, funds locked forever |
| **Privilege escalation to owner** | Attacker gains owner role |

**Likelihood**: Can be exploited with reasonable effort, no special conditions required.

### Medium Severity

**Impact**: Limited fund loss, conditional exploits, or significant disruption.

| Criteria | Examples |
|----------|----------|
| **Conditional fund loss** | Exploit requires specific market conditions |
| **Partial access control bypass** | Some protected functions accessible |
| **Temporary DoS** | Contract paused but recoverable |
| **Value leakage** | Small amounts lost per transaction |
| **Griefing attacks** | Attacker can cause loss to others at own cost |

**Likelihood**: Requires specific conditions or elevated permissions.

### Low Severity

**Impact**: Minimal fund loss, edge cases, or best practice violations.

| Criteria | Examples |
|----------|----------|
| **Edge case failures** | Very rare conditions cause issues |
| **Dust amount losses** | Rounding errors, wei-level losses |
| **Non-critical DoS** | Temporary, self-recovering |
| **Best practice violations** | Missing events, poor error messages |

**Likelihood**: Difficult to exploit or minimal impact even if exploited.

### Informational / QA

**Impact**: No direct security impact, code quality issues.

| Criteria | Examples |
|----------|----------|
| **Code style** | Naming conventions, formatting |
| **Documentation gaps** | Missing NatSpec, unclear comments |
| **Unused code** | Dead code, unused imports |
| **Optimization suggestions** | Could be improved but not required |

### Gas Optimization

**Impact**: Inefficient gas usage with no security impact.

| Criteria | Examples |
|----------|----------|
| **Storage optimization** | Packing, caching state reads |
| **Loop optimization** | Unchecked increments, early exits |
| **Function visibility** | External vs public |
| **Memory vs calldata** | Parameter optimization |

---

## Platform-Specific Mappings

### Code4rena

| Severity | Risk Level | Award Multiplier |
|----------|------------|------------------|
| High | 3 | Highest |
| Medium | 2 | Medium |
| Low/QA | QA Report | Grouped submission |
| Gas | Gas Report | Separate submission |

**Notes**:
- High and Medium are individual submissions
- Low findings go into single QA Report
- Gas findings go into single Gas Report
- Upgrading from QA to Med/High not allowed

### Cantina

| Severity | Label | Status Options |
|----------|-------|----------------|
| Critical | Critical Risk | Fixed / Acknowledged |
| High | High Risk | Fixed / Acknowledged |
| Medium | Medium Risk | Fixed / Acknowledged |
| Low | Low Risk | Fixed / Acknowledged |
| Informational | Informational | Fixed / Acknowledged |
| Gas | Gas Optimization | Fixed / Acknowledged |

**Notes**:
- Each finding tracked individually
- Fix status with commit reference
- Researcher attribution included

### Sherlock

| Severity | Payout Tier | Judging |
|----------|-------------|---------|
| High | Highest | Decentralized |
| Medium | Medium | Decentralized |
| Low | Not awarded | Informational only |

**Notes**:
- Only High and Medium are awarded
- Duplicates deduplicated by judges
- 72-hour acknowledgment window for protocols

### Immunefi

| Severity | Typical Payout Range |
|----------|---------------------|
| Critical | $10,000 - $10,000,000+ |
| High | $5,000 - $50,000 |
| Medium | $1,000 - $10,000 |
| Low | $100 - $1,000 |

**Notes**:
- Payouts vary by program
- PoC required for most submissions
- Impact must match program's threat model

---

## Severity Decision Tree

```
Is there direct fund loss?
├── YES → How much?
│   ├── Significant (>1% TVL or unlimited) → HIGH/CRITICAL
│   ├── Limited (conditional or capped) → MEDIUM
│   └── Minimal (dust, rounding) → LOW
│
└── NO → Is there access control bypass?
    ├── YES → What level?
    │   ├── Owner/Admin functions → HIGH
    │   ├── Privileged functions → MEDIUM
    │   └── Non-critical functions → LOW
    │
    └── NO → Is there DoS?
        ├── YES → Is it permanent?
        │   ├── YES → HIGH
        │   └── NO → MEDIUM/LOW
        │
        └── NO → Is it a code quality issue?
            ├── YES → INFORMATIONAL/QA
            └── NO → GAS (if efficiency related)
```

---

## Common Pitfalls

### Over-Severity

- Theoretical attacks without realistic path → Lower severity
- Requires compromised trusted party → Lower severity
- Requires unrealistic market conditions → Lower severity

### Under-Severity

- "Small" amounts that compound → May be higher
- Griefing that enables larger attacks → May be higher
- Access control issues in upgradeable contracts → Usually higher

---

## References

- [Code4rena Severity Categorization](https://docs.code4rena.com/awarding/judging-criteria/severity-categorization)
- [Immunefi Vulnerability Severity Classification](https://immunefi.com/immunefi-vulnerability-severity-classification-system-v2-3/)
- [Sherlock Judging Guidelines](https://docs.sherlock.xyz/audits/judging)
- [OWASP Smart Contract Top 10 2025](https://owasp.org/www-project-smart-contract-top-10/)

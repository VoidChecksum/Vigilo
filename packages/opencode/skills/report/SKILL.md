---
name: report
description: >
  Generates submission-ready audit reports from validated findings. Use when:
  (1) Audit Phase 4 invokes Skill(vigilo:report) after PoC validation completes,
  (2) Findings need to be formatted for Code4rena, Cantina, Sherlock, or Immunefi submission,
  (3) Generating executive summary or individual submission reports.
  Default format: Code4rena. Reads from .vigilo/findings/ and poc/.
---

# Audit Report Generation

## Purpose

Generate professional security audit reports following industry standards from platforms like
Code4rena, Cantina, Sherlock, and Immunefi.

---

## Supported Platforms

| Platform | Use Case | Format |
|----------|----------|--------|
| **Code4rena** | Competitive audits | Markdown with specific sections |
| **Cantina** | Managed reviews | PDF-style structured report |
| **Sherlock** | Contest submissions | GitHub issue format |
| **Immunefi** | Bug bounty submissions | Dashboard submission format |
| **Standard** | General purpose | Comprehensive markdown |

---

## Data Flow (Option B - Immutable Drafts)

```
.vigilo/findings/    ← Sub-auditor drafts (IMMUTABLE)
         +
.vigilo/poc/         ← PoC validation logs
         ↓
.vigilo/reports/submissions/  ← Final submission-ready reports
```

**Key Principle**: Original findings are preserved as audit trail. Final reports are synthesized from findings + PoC validation.

---

## Workflow

### Step 1: Collect Data Sources

```
# Sub-auditor draft findings
Glob(".vigilo/findings/**/*.md")

# PoC validation results
Glob(".vigilo/poc/*.md")

# Actual PoC code
Glob("test/poc/*.t.sol")
```

### Step 2: Filter by Validation Status

| Status | Action |
|--------|--------|
| `VALIDATED` | Generate submission report |
| `NEEDS_REVIEW` | Include in separate "Unconfirmed" section |
| `INVALIDATED` | Exclude (false positive) |

### Step 3: Select Platform

1. Check user-specified platform
2. **Default: Code4rena** format (most common)

| Platform | Template |
|----------|----------|
| Code4rena (default) | [templates/code4rena.md](templates/code4rena.md) |
| Cantina | [templates/cantina.md](templates/cantina.md) |
| Sherlock | [templates/sherlock.md](templates/sherlock.md) |
| Immunefi | [templates/immunefi.md](templates/immunefi.md) |
| Standard | [templates/standard.md](templates/standard.md) |

### Step 4: Generate Submission Reports

For each VALIDATED finding, create submission-ready report:

**Filename format**: `{Severity}-{id}-{kebab-case-title}.md`

```
.vigilo/reports/submissions/H-01-donation-attack-inflated-collateral.md
```

**Each submission report MUST include:**

1. **Refined Attack Scenario** - Updated based on PoC validation
2. **Validated PoC Code** - INLINE (not just reference)
3. **Proof of Impact** - Console output showing actual exploit
4. **Platform-specific formatting**

### Step 5: Write Outputs

```
.vigilo/reports/
├── {date}_{platform}_audit.md      # Executive summary
└── submissions/
    ├── H-01-donation-attack-inflated-collateral.md   # Ready to submit
    ├── H-02-reentrancy-callback-drain.md
    ├── M-01-stale-price-check.md
    └── QA-report.md
```

---

## Submission Report Template

Each `submissions/{finding-id}.md` must be **immediately submittable**:

```markdown
# [H-01] Title Describing Vulnerability

## Summary
One-sentence description of the issue.

## Vulnerability Detail
Technical explanation of the vulnerability.
- Root cause
- Affected functions
- Attack vector

## Impact
Qualitative impact description (NO dollar amounts).

## Proof of Concept

\`\`\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";

contract PoC_H01 is Test {
    function test_Exploit() public {
        // Full PoC code here - INLINE
        // Not just a file reference
    }
}
\`\`\`

**Execution:**
\`\`\`bash
forge test --match-test test_Exploit -vvv
\`\`\`

**Output:**
\`\`\`
[PASS] test_Exploit()
  Attacker balance before: 1 ETH
  Attacker balance after: 101 ETH
  Profit: 100 ETH
\`\`\`

## Recommendation
Specific fix with code example.
```

---

## Severity Classification

All platforms use similar severity levels with slight variations:

| Vigilo | Code4rena | Cantina | Sherlock | Immunefi |
|--------|-----------|---------|----------|----------|
| Critical | High (3) | Critical | High | Critical |
| High | High (3) | High | High | High |
| Medium | Medium (2) | Medium | Medium | Medium |
| Low | Low (QA) | Low | Low | Low |
| Informational | QA | Informational | Informational | Informational |
| Gas | Gas | Gas Optimization | - | Gas Optimization |

See `references/severity-classification.md` for detailed criteria.

---

## Output Structure

### Report File Naming

```
.vigilo/reports/{YYYY_MM_DD_HHMM}_{platform}_audit.md
```

Examples:
- `2026_01_20_1430_code4rena_audit.md`
- `2026_01_20_1430_standard_audit.md`

### Individual Finding Export

For contest submissions, also export individual findings:

**Filename format**: `{Severity}-{id}-{kebab-case-title}.md`

```
.vigilo/reports/submissions/
├── H-01-donation-attack-inflated-collateral.md
├── H-02-reentrancy-callback-drain.md
├── M-01-stale-price-check.md
└── QA-report.md
```

---

## Submission Quality Checklist

**Before marking a report as ready to submit:**

### Content Requirements
- [ ] Attack scenario refined based on PoC validation
- [ ] PoC code is **INLINE** (not just file reference)
- [ ] PoC output proves the claimed impact
- [ ] Impact is qualitative (NO dollar amounts)
- [ ] Recommendation includes specific code fix

### Platform Compliance
- [ ] Follows exact platform template structure
- [ ] Severity mapped to platform standard
- [ ] Title format matches platform convention
- [ ] All required sections present

### Submission Readiness
- [ ] Can be copy-pasted directly to platform
- [ ] No placeholder text remaining
- [ ] No internal notes or TODOs
- [ ] forge test command and output included

**If any checkbox fails → NOT ready for submission**

---

## Additional Resources

### Templates (Load based on target platform)

| Template | When to Load |
|----------|--------------|
| [code4rena.md](templates/code4rena.md) | **Default** - When submitting to Code4rena contests |
| [sherlock.md](templates/sherlock.md) | When submitting to Sherlock contests |
| [cantina.md](templates/cantina.md) | When submitting to Cantina reviews |
| [immunefi.md](templates/immunefi.md) | When submitting to Immunefi bug bounties |
| [standard.md](templates/standard.md) | For general/private audit reports |

### References (Load on demand)

| File | When to Load |
|------|--------------|
| [severity-classification.md](references/severity-classification.md) | When determining severity - contains platform-specific criteria |

### External References (For validation)

- [Code4rena Reports](https://code4rena.com/reports) - Reference for report format
- [Solodit Database](https://solodit.cyfrin.io) - Cross-reference similar findings

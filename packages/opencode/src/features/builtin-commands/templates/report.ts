export const REPORT_TEMPLATE = `# /report - Generate Audit Reports

Generates submission-ready audit reports from validated findings.

## Usage

\`\`\`
/report                          # Generate reports for all validated findings
/report --platform=sherlock      # Use Sherlock format (default: code4rena)
/report --finding=H-01           # Generate report for specific finding
/report --summary                # Generate executive summary only
\`\`\`

---

## Supported Platforms

| Platform | Use Case | Format |
|----------|----------|--------|
| **Code4rena** | Competitive audits (default) | Markdown with specific sections |
| **Cantina** | Managed reviews | PDF-style structured report |
| **Sherlock** | Contest submissions | GitHub issue format |
| **Immunefi** | Bug bounty submissions | Dashboard submission format |
| **Standard** | General purpose | Comprehensive markdown |

---

## Data Flow

\`\`\`
.vigilo/findings/    <- Sub-auditor drafts (IMMUTABLE)
         +
.vigilo/poc/         <- PoC validation logs
         |
         v
.vigilo/reports/submissions/  <- Final submission-ready reports
\`\`\`

---

## Workflow

<critical>
**TodoWrite for tracking. Mark in_progress -> completed.**
\`\`\`
TodoWrite([
  { id: "collect", content: "Collect validated findings and PoC results", status: "pending", priority: "high" },
  { id: "generate", content: "Generate submission reports", status: "pending", priority: "high" },
  { id: "review", content: "Review and finalize", status: "pending", priority: "medium" }
])
\`\`\`
</critical>

---

## Step 1: Collect Data Sources

\`\`\`
# Sub-auditor draft findings
Glob(".vigilo/findings/**/*.md")

# PoC validation results
Glob(".vigilo/poc/*.md")

# Actual PoC code
Glob("test/poc/*.t.sol")
\`\`\`

## Step 2: Filter by Validation Status

| Status | Action |
|--------|--------|
| VALIDATED | Generate submission report |
| NEEDS_REVIEW | Include in separate "Unconfirmed" section |
| INVALIDATED | Exclude (false positive) |

## Step 3: Generate Submission Reports

For each VALIDATED finding, create submission-ready report:

**Filename format**: \`{Severity}-{id}-{kebab-case-title}.md\`

\`\`\`
.vigilo/reports/submissions/H-01-donation-attack-inflated-collateral.md
\`\`\`

**Each submission report MUST include:**

1. **Refined Attack Scenario** - Updated based on PoC validation
2. **Validated PoC Code** - INLINE (not just reference)
3. **Proof of Impact** - Console output showing actual exploit
4. **Platform-specific formatting**

---

## Submission Report Template

\`\`\`markdown
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

\\\`\\\`\\\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";

contract PoC_H01 is Test {
    function test_Exploit() public {
        // Full PoC code here - INLINE
    }
}
\\\`\\\`\\\`

**Execution:**
\\\`\\\`\\\`bash
forge test --match-test test_Exploit -vvv
\\\`\\\`\\\`

**Output:**
\\\`\\\`\\\`
[PASS] test_Exploit()
  Attacker balance before: 1 ETH
  Attacker balance after: 101 ETH
\\\`\\\`\\\`

## Recommendation
Specific fix with code example.
\`\`\`

---

## Output Structure

\`\`\`
.vigilo/reports/
├── {date}_{platform}_audit.md      # Executive summary
└── submissions/
    ├── H-01-donation-attack.md     # Ready to submit
    ├── H-02-reentrancy.md
    ├── M-01-stale-price.md
    └── QA-report.md
\`\`\`

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

**If any checkbox fails -> NOT ready for submission**

---

## Final Report

\`\`\`
=== Report Generation Complete ===

Platform: {platform}
Date: {date}

Reports Generated:
  [OK] H-01-donation-attack.md (VALIDATED)
  [OK] H-02-reentrancy.md (VALIDATED)
  [OK] M-01-stale-price.md (VALIDATED)
  [--] M-02-centralization.md (NEEDS_REVIEW)

Summary: .vigilo/reports/{date}_{platform}_audit.md
Submissions: .vigilo/reports/submissions/

Ready for submission to {platform}.
\`\`\``

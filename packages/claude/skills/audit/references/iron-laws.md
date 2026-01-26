# Iron Laws (NO EXCEPTIONS)

Critical rules that must be followed throughout the audit workflow.

---

## 1. CHECK SCOPE FIRST

```
❌ WRONG: Reading all *.sol files without checking scope.txt
✅ RIGHT: Read("scope.txt") FIRST, then analyze only in-scope files
```

**Why**: Out-of-scope files waste time and may include test/mock contracts that skew analysis.

---

## 2. NO VALIDATED FINDING WITHOUT POC

```
❌ WRONG: Marking H-01 as VALIDATED because the scenario looks correct
✅ RIGHT: Marking H-01 as VALIDATED after forge test passes AND proves impact
```

**Why**: Attack scenarios can be theoretically correct but practically impossible. PoC proves exploitability.

---

## 3. NO POC WITHOUT ATTACK SCENARIO

```
❌ WRONG: Writing PoC code before sub-auditors generate attack scenarios
✅ RIGHT: Generating PoC code FROM the attack scenario's preconditions and steps
```

**Why**: Sub-auditors provide domain-specific analysis. PoC synthesizes their scenarios.

---

## 4. NO DOLLAR AMOUNTS IN IMPACT

```
❌ WRONG: "Attacker profits $1.5M from the exploit"
✅ RIGHT: "Attacker drains entire vault TVL"
```

**Why**: Dollar amounts are speculative and change over time. Describe impact in protocol terms.

---

## 5. CHECK RECON FILES EXPLICITLY

```
❌ WRONG: Glob(".vigilo/**/*") then assume no recon
✅ RIGHT: Read(".vigilo/recon/docs-findings.md") to check existence
```

**Why**: Glob patterns can miss files or return unexpected results. Explicit checks are reliable.

---

## 6. CREATE DIRECTORIES ON AUDIT START

```
❌ WRONG: Expecting directories to exist before /vigilo:audit invocation
✅ RIGHT: Create directories at the start of audit workflow (Phase 0)
```

**Why**: Fresh sessions have no directories. Phase 0 must initialize the session structure.

---

## 7. AUTO-CONTINUE BETWEEN PHASES

```
❌ WRONG: Waiting for user input between phases
✅ RIGHT: Automatic progression through all phases
```

**Why**: The audit pipeline is designed to run end-to-end. Stopping breaks flow and context.

---

## 8. SUB-AUDITORS: SCENARIOS ONLY, NO POC

```
❌ WRONG: Sub-auditors writing PoC code in their findings
✅ RIGHT: Sub-auditors write attack scenarios; main agent generates PoC
```

**Why**: Main agent has context across all findings. PoC generation requires project-wide setup.

---

## 9. TEST PASS ≠ VALIDATED

```
❌ WRONG: forge test PASS → Mark as VALIDATED
✅ RIGHT: forge test PASS + assertions prove claimed impact → VALIDATED
```

**Why**: A passing test might not actually prove the vulnerability. Assertions must match claimed impact.

---

## Summary Table

| Rule | Wrong | Right |
|------|-------|-------|
| Scope | Analyze all files | Check scope.txt first |
| Validation | Scenario looks correct | PoC proves impact |
| PoC Order | Write PoC first | Scenario → PoC |
| Impact | "$1.5M profit" | "Entire vault TVL" |
| Recon Check | Glob patterns | Explicit file read |
| Directories | Expect existing | Create in Phase 0 |
| Phases | Wait for user | Auto-continue |
| Sub-auditors | Include PoC | Scenarios only |
| Test Status | Pass = Valid | Pass + Impact = Valid |

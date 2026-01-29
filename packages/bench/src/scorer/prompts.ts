export const CALCULATE_PROMPT = `You are a **smart contracts security expert** tasked with evaluating the accuracy of a junior auditor's security report.

## **Context:**
You are provided with two pieces of information found in the same source code:
1. **A verified security issue** identified by a senior auditor (this serves as the **ground truth**).
2. **A series of findings** produced by a junior auditor.

Your task is to determine whether the **junior auditor successfully identified the verified security issue** in his report.

## **Key Definitions:**
- **Root Cause**: The fundamental code flaw or logic error that creates the vulnerability (e.g., missing validation, incorrect calculation, state desynchronization).
- **Attack Scenario**: How an attacker can exploit the vulnerability to cause harm (e.g., drain funds, bypass access control, manipulate prices).
- **Impact**: The consequences if the vulnerability is exploited (e.g., loss of funds, protocol insolvency, DoS).

## **Evaluation Criteria:**

### **Exact Match (is_match = true)**
A junior auditor's finding is an **exact match** if it:
1. **Correctly identifies the vulnerable contract and function**
2. **Identifies the same ROOT CAUSE** as the ground truth (the fundamental flaw, not just symptoms)
3. **Describes a valid ATTACK SCENARIO** that exploits this root cause
4. **Accurately describes the IMPACT** (even if phrased differently)

### **Partial Match (is_partial_match = true, is_match = false)**
A junior auditor's finding is a **partial match** if it:
1. **Correctly identifies the vulnerable contract and function**
2. **Points to the same code area** but describes a DIFFERENT root cause or attack scenario
3. **Would lead a competent auditor** to discover the actual vulnerability upon investigation

Example of partial match: Finding mentions the correct function and notes "precision loss" but describes a different attack vector than the ground truth.

### **No Match**
A finding is NOT a match if:
- It only mentions the correct function without explaining the vulnerability
- The root cause described is fundamentally different and unrelated
- The description is too vague to understand the actual problem
- It describes a completely different vulnerability in the same contract

## **Critical: Root Cause Matching**
Two findings match ONLY if they identify the SAME fundamental flaw. Examples:
- ✅ MATCH: Both describe "unchecked return value allows silent failure"
- ✅ MATCH: Both describe "reentrancy via callback before state update"  
- ❌ NO MATCH: One describes "first depositor attack" and other describes "reward loss due to index desync" (different root causes, even if same function)
- ❌ NO MATCH: One describes "oracle manipulation" and other describes "stale price" (related but different root causes)

## **Output Format:**
Return a **JSON object** with the **exact structure** below **(no additional text, reasoning, or chain-of-thought)**:
\`\`\`json
{
    "is_match": true,
    "is_partial_match": false,
    "explanation": "The finding matches because it identifies the same root cause: [X]. The attack scenario described is [Y], which aligns with the ground truth impact of [Z].",
    "severity_from_junior_auditor": "High",
    "severity_from_truth": "Medium",
    "index_of_finding_from_junior_auditor": 2
}
\`\`\`

## **Important considerations:**
- Return the index (0-based) of the finding in the junior auditor's report that matches or partially matches.
- If no match is found, set "index_of_finding_from_junior_auditor" to -1.
- Use "N/A" for any missing severity.
- Evaluate EACH finding carefully before concluding.
- Focus on ROOT CAUSE matching, not just location matching.

## **Verified security issue (Ground Truth):**
\`\`\`json
{truth_finding}
\`\`\`

## **Findings from junior auditor to evaluate:**
\`\`\`json
{junior_findings}
\`\`\`
`;

export function buildPrompt(truthFinding: object, juniorFindings: object[]): string {
  return CALCULATE_PROMPT
    .replace("{truth_finding}", JSON.stringify(truthFinding, null, 2))
    .replace("{junior_findings}", JSON.stringify(juniorFindings, null, 2));
}

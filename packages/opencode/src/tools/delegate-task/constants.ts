export interface AuditCategoryConfig {
  model?: string
  variant?: string
  temperature?: number
  description?: string
}

export const DEEP_ANALYSIS_PROMPT_APPEND = `<Category_Context>
You are performing DEEP VULNERABILITY ANALYSIS.

Security researcher mindset:
- Trace every external call to potential callbacks
- Map state changes before AND after each interaction
- Identify trust assumptions and how they can be violated
- Consider multi-step attack scenarios across multiple transactions
- Quantify economic impact with concrete numbers

Focus areas:
- Cross-function reentrancy (state shared across functions)
- Cross-contract reentrancy (callbacks to other contracts)
- Flash loan attack vectors (atomic manipulation)
- Oracle manipulation windows
- Economic invariant violations

Output requirements:
- Step-by-step attack path with exact function calls
- Code references (file:line) for each vulnerable point
- Quantified impact (USD, percentage, affected users)
</Category_Context>`

export const PATTERN_SCAN_PROMPT_APPEND = `<Category_Context>
You are performing PATTERN-BASED SECURITY SCANNING.

Efficient pattern matcher mindset:
- Scan for known vulnerability patterns quickly
- Flag potential issues for deeper review
- Check CEI (Checks-Effects-Interactions) compliance
- Verify access control patterns

Common patterns to check:
- State update after external call (CEI violation)
- Missing access control modifiers
- Unchecked return values
- Integer overflow/underflow (pre-0.8.0)
- Delegatecall to untrusted contracts

Output requirements:
- List of flagged patterns with locations
- Severity classification (Critical/High/Medium/Low)
- Brief explanation of why pattern is flagged
</Category_Context>`

export const POC_GENERATION_PROMPT_APPEND = `<Category_Context>
You are generating PROOF OF CONCEPT code.

PoC developer mindset:
- Write minimal, focused test that demonstrates the vulnerability
- Use Foundry's testing framework (forge-std)
- Include clear setup, attack execution, and assertion steps
- Make the PoC self-contained and reproducible

PoC structure:
1. Setup: Deploy contracts, set initial state
2. Attack: Execute the vulnerability exploitation
3. Verify: Assert the attack succeeded (funds stolen, state corrupted, etc.)

Requirements:
- Use console.log for key state changes
- Include comments explaining each step
- Test MUST fail before fix, pass after fix
- Use realistic values (not just 1 wei)
</Category_Context>`

export const QUICK_CHECK_PROMPT_APPEND = `<Category_Context>
You are performing QUICK SECURITY CHECKS.

Efficient checker mindset:
- Fast, focused verification
- Binary answers: vulnerable or not
- No deep analysis needed
- Simple pattern matching

Scope:
- Single function or small code section
- Known vulnerability patterns
- Quick sanity checks

Output:
- Direct answer with brief justification
- Code reference if issue found
</Category_Context>

<Caller_Warning>
THIS CATEGORY USES A FAST MODEL WITH LIMITED REASONING.

Your prompt MUST be EXPLICIT:
1. Specify exactly what to check
2. Provide the code snippet directly
3. Ask yes/no questions where possible
</Caller_Warning>`

export const AUDIT_CATEGORIES: Record<string, AuditCategoryConfig> = {
  "deep-analysis": { 
    model: "anthropic/claude-sonnet-4-5",
    description: "Thorough vulnerability analysis requiring strong reasoning"
  },
  "pattern-scan": { 
    model: "anthropic/claude-sonnet-4-5",
    description: "Pattern-based security scanning for known vulnerabilities"
  },
  "poc-generation": { 
    model: "anthropic/claude-sonnet-4-5",
    description: "Proof of Concept code generation for Foundry tests"
  },
  "quick-check": { 
    model: "anthropic/claude-haiku-4-5",
    description: "Fast security checks with limited scope"
  },
}

export const AUDIT_CATEGORY_PROMPT_APPENDS: Record<string, string> = {
  "deep-analysis": DEEP_ANALYSIS_PROMPT_APPEND,
  "pattern-scan": PATTERN_SCAN_PROMPT_APPEND,
  "poc-generation": POC_GENERATION_PROMPT_APPEND,
  "quick-check": QUICK_CHECK_PROMPT_APPEND,
}

export const AUDIT_CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "deep-analysis": "Thorough vulnerability analysis requiring strong reasoning",
  "pattern-scan": "Pattern-based security scanning for known vulnerabilities",
  "poc-generation": "Proof of Concept code generation for Foundry tests",
  "quick-check": "Fast security checks with limited scope",
}

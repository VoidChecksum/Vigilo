# Learnings - baseline-comparison-fix

## Conventions & Patterns

(To be populated by subagents)

## Task 1: Update ScaBenchBaseline Interface (2025-01-31 20:15 UTC)

### Implementation Details
- **File Modified**: `packages/bench/src/types.ts`
- **Change**: Added `ScaBenchBaseline` interface with optional `scoring` metadata field
- **New Interfaces**:
  1. `ScoringMetadata` - Contains scoring evaluation metrics
  2. `ScaBenchBaseline` - Extended with optional `scoring?: ScoringMetadata` field

### Scoring Metadata Structure
```typescript
interface ScoringMetadata {
  detection_rate: number;        // exact matches / truth count
  partial_rate: number;          // (exact + partial) / truth count
  truth_file: string;            // e.g., "sherlock_tally_2024_12.json"
  truth_count: number;           // number of ground truth findings
  exact_matches: number;         // count of exact matches
  partial_matches: number;       // count of partial matches
  scored_at: string;             // ISO timestamp
  model_used: string;            // LLM model used for scoring
  iterations: number;            // majority voting iterations
}
```

### Key Design Decisions
1. **Optional Field**: `scoring?:` makes field optional for backward compatibility
2. **Separate Interface**: `ScoringMetadata` extracted for reusability and clarity
3. **Naming Convention**: Followed `BaselineComparison` interface pattern (snake_case for fields)
4. **Type Safety**: All fields properly typed (number, string)

### Verification Results
- ✅ TypeScript compilation: `bun run typecheck` passed with no errors
- ✅ Interface properly exported from types.ts
- ✅ Backward compatible (optional field doesn't break existing code)

### Pattern Notes
- Types file uses snake_case for field names (e.g., `files_analyzed`, `reported_by_model`)
- Interfaces are exported at module level
- Complex nested types use inline Array<{...}> syntax

## Task 4: Bun Test Infrastructure Setup (2025-01-31)

### Pattern: Test Script Configuration
- **Location**: `packages/bench/package.json`
- **Pattern**: `"test": "bun test"` (matches opencode package)
- **Key**: Simple, consistent across monorepo

### Pattern: Test File Organization
- **Location**: `src/__tests__/` directory
- **Naming**: `*.test.ts` files
- **Pattern**: Follows opencode convention (e.g., `manager.test.ts`)

### Pattern: BDD Test Structure
- **Format**: `#given`, `#when`, `#then` comments
- **Framework**: `bun:test` (built-in, no external deps)
- **Imports**: `import { describe, test, expect } from "bun:test"`
- **Reference**: `packages/opencode/src/features/background-agent/manager.test.ts`

### Pattern: Test Discovery Configuration
- **File**: `bunfig.toml` (Bun config)
- **Setting**: `[test] root = "src"`
- **Purpose**: Prevents test runner from picking up test files in data/sources
- **Issue Solved**: Without this, bun test would fail on hardhat/chai tests in cloned repos

### Test Infrastructure Verification
- ✅ Test script added to package.json
- ✅ Example test file created with 4 passing tests
- ✅ Test discovery configured via bunfig.toml
- ✅ `bun test` runs successfully: 4 pass, 0 fail
- ✅ Atomic commit created

### Key Takeaway
Bun test infrastructure is minimal and clean. The bunfig.toml configuration is critical for monorepos with nested test files in data directories.

## Task 2: Create Baseline Scoring Function (2025-01-31 20:23 UTC)

### Implementation Details
- **File Created**: `packages/bench/src/scorer/baseline-scorer.ts`
- **Exported Function**: `scoreBaseline(baseline, truthFindings, options?)`
- **Return Type**: `Promise<ScoringMetadata>`

### Key Design Decisions

1. **Reuse Matching Logic**: Imports `matchTruthFinding()` from `llm-scorer.ts`
   - Required exporting previously private function
   - Also exported `WorkingFinding` interface for type compatibility
   - Ensures consistency between Vigilo and baseline scoring

2. **Majority Voting**: Uses same 3-iteration approach as Vigilo
   - Configurable via `options.iterations` (default: 3)
   - Passed through to `matchTruthFinding()` via `ScorerConfig`

3. **Baseline Finding Conversion**: Maps ScaBench baseline format to VigiloFinding
   ```typescript
   baseline.findings.map(f => ({
     id: f.id,
     title: f.title,
     severity: f.severity.toLowerCase(),
     auditor: f.vulnerability_type || "baseline",
     description: f.description,
     file: f.file,
     filePath: f.location || f.file,
     originalIndex: idx,
   }))
   ```

4. **Double-Match Prevention**: Tracks matched indices to prevent same finding matching multiple truths
   - Uses `Set<number>` to track `originalIndex` of matched findings
   - Filters `availableFindings` before each match attempt

5. **Metrics Calculation**: Follows same pattern as llm-scorer.ts
   - `detection_rate = exact_matches / truth_count`
   - `partial_rate = (exact_matches + partial_matches) / truth_count`

### Modifications to llm-scorer.ts
- **Line 8**: Changed `interface WorkingFinding` → `export interface WorkingFinding`
- **Line 119**: Changed `async function matchTruthFinding` → `export async function matchTruthFinding`
- **Reason**: Needed for reuse in baseline-scorer.ts

### Verification Results
- ✅ TypeScript compilation: `bun run typecheck` passed
- ✅ Import verified: `matchTruthFinding` imported from `./llm-scorer.js`
- ✅ Function exported: `scoreBaseline` is public API
- ✅ Returns `ScoringMetadata` with all 9 required fields

### Pattern Notes
- **Verbose Logging**: Uses `picocolors` for colored output (matches llm-scorer pattern)
- **Config Pattern**: Accepts optional `BaselineScoringOptions`, converts to `ScorerConfig`
- **Environment Variable**: Respects `BENCH_MODEL` env var (default: `anthropic/claude-opus-4-5`)
- **Async/Await**: Properly handles async `matchTruthFinding()` calls in loop

### Key Takeaway
Reusing `matchTruthFinding()` ensures baseline scoring uses identical matching logic as Vigilo scoring, making comparisons fair and consistent. The function was designed to be private but is now a shared utility.

## Task 3: Create score-baseline CLI Command (2025-01-31)

### Implementation Details
- **File Created**: `packages/bench/src/commands/score-baseline.ts`
- **Exported Function**: `scoreBaseline_(contestId, options)`
- **Command Name**: `score-baseline` (registered in cli.ts)

### Command Signature
```bash
bunx vigilo-bench score-baseline <contest-id> [--iterations N] [-v|--verbose]
```

### Key Implementation Features

1. **Validation**: Checks for baseline and ground truth files before scoring
   - Baseline path: `data/baselines/baseline_{contestId}.json`
   - Truth path: `data/truth/{contestId}.json`
   - Errors gracefully if either is missing

2. **Atomic File Writing**: Uses temp file + rename pattern
   ```typescript
   const tempPath = `${baselinePath}.tmp`;
   writeFileSync(tempPath, JSON.stringify(updatedBaseline, null, 2));
   const fs = await import("fs/promises");
   await fs.rename(tempPath, baselinePath);
   ```
   - Prevents partial writes if process crashes
   - Atomic on most filesystems

3. **Baseline Update**: Adds `scoring` metadata to baseline JSON
   - Preserves all existing baseline fields
   - Adds new `scoring?: ScoringMetadata` field
   - Uses spread operator: `{ ...baseline, scoring: scoringMetadata }`

4. **Registry Update**: Updates contest status to "baseline-scored"
   - Follows same pattern as `score.ts` command
   - Loads registry, finds entry, updates status, saves

5. **Logging**: Provides detailed output
   - Shows baseline and truth counts
   - Displays match counts (exact, partial, missed)
   - Shows detection/partial rates as percentages
   - Reports scoring duration and model used

### Type System Changes
- **File Modified**: `packages/bench/src/types.ts`
- **Change**: Added `"baseline-scored"` to `ContestStatus` type
  ```typescript
  export type ContestStatus = "pending" | "audited" | "scored" | "baseline-scored";
  ```
- **Reason**: Registry needs to track baseline scoring status separately

### CLI Registration
- **File Modified**: `packages/bench/src/cli.ts`
- **Import**: Added `import { scoreBaseline_ } from "./commands/score-baseline.js"`
- **Command**: Registered with commander.js
  ```typescript
  program
    .command("score-baseline <contest-id>")
    .description("Score baseline findings against ground truth using LLM")
    .option("--iterations <n>", "Number of LLM iterations for majority voting", "3")
    .option("-v, --verbose", "Show detailed scoring process")
    .action(scoreBaseline_);
  ```

### Verification Results
- ✅ TypeScript compilation: `bun run typecheck` passed
- ✅ Command help: `bunx vigilo-bench score-baseline --help` displays correctly
- ✅ Atomic write pattern implemented
- ✅ Ground truth validation in place
- ✅ Registry status tracking added

### Pattern Notes
- **Function Naming**: Used `scoreBaseline_` (with underscore) to avoid conflict with imported `scoreBaseline` function
- **JSON Formatting**: Uses 2-space indent (consistent with checkout.ts pattern)
- **Error Handling**: Uses `error()` utility for fatal errors (exits process)
- **Logging**: Uses `log()` utility with consistent formatting
- **Options Pattern**: Matches `score.ts` command (iterations, verbose)

### Key Takeaway
The score-baseline command follows established patterns from score.ts and checkout.ts, ensuring consistency across the CLI. Atomic file writing prevents data corruption, and registry tracking enables workflow orchestration.

## Task 5: Fix computeBaselineComparison() to Use Actual Baseline Scores (2025-01-31)

### Implementation Details
- **File Modified**: `packages/bench/src/utils.ts`
- **Change**: Replaced hardcoded 0s with actual baseline scoring values
- **Lines Changed**: 108-113 (previously 126-127)

### The Bug
```typescript
// BEFORE (hardcoded 0s):
const baselineDetectionRate = 0;
const baselineExactMatches = 0;

// AFTER (actual values):
const baselineDetectionRate = baseline.scoring?.detection_rate ?? 0;
const baselineExactMatches = baseline.scoring?.exact_matches ?? 0;

if (!baseline.scoring) {
  console.warn(`[bench] Baseline scoring metadata missing for project "${baseline.project}". Using default values (0).`);
}
```

### Key Changes

1. **Optional Chaining with Nullish Coalescing**:
   - `baseline.scoring?.detection_rate ?? 0` - reads detection_rate if scoring exists, defaults to 0
   - `baseline.scoring?.exact_matches ?? 0` - reads exact_matches if scoring exists, defaults to 0
   - Maintains backward compatibility for unscored baselines

2. **Console Warning**:
   - Added warning when `baseline.scoring` is missing
   - Helps debug cases where baseline wasn't scored
   - Uses `[bench]` prefix to match existing logging pattern

3. **Removed Duplicate Interface**:
   - Found duplicate `ScaBenchBaseline` interface in utils.ts (lines 92-110)
   - This duplicate didn't have the `scoring` field added in Task 1
   - Removed duplicate and imported from types.ts instead
   - Updated import: `import type { ..., ScaBenchBaseline } from "./types.js"`

### Verification Results
- ✅ TypeScript compilation: `bun run typecheck` passed with no errors
- ✅ Hardcoded 0s removed: `grep "baselineDetectionRate = 0"` returns exit code 1 (not found)
- ✅ Backward compatible: Unscored baselines default to 0 with warning
- ✅ Atomic commit created: `fix(bench): use actual baseline scores in computeBaselineComparison()`

### Pattern Notes
- **Optional Chaining**: TypeScript 3.7+ feature, widely used in codebase
- **Nullish Coalescing**: Distinguishes between null/undefined (use default) vs falsy values
- **Logging Pattern**: Uses `console.warn` with `[bench]` prefix (matches `log()` and `error()` functions)
- **Import Organization**: Types imported from types.ts, not duplicated in utils.ts

### Critical Discovery
The duplicate `ScaBenchBaseline` interface in utils.ts was a major issue:
- It was defined without the `scoring` field
- TypeScript was using this definition instead of the one from types.ts
- This caused the "Property 'scoring' does not exist" error
- Solution: Remove duplicate, import from types.ts (single source of truth)

### Key Takeaway
Always check for duplicate type definitions in monorepos. TypeScript will use the first definition it finds, which can shadow updated definitions in other files. Centralizing types in a single file (types.ts) prevents this issue.

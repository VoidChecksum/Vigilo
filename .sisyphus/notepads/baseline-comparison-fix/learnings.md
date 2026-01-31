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

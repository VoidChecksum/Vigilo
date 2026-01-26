export const FOUNDRY_BUILD_DESCRIPTION =
  "Compile Solidity contracts with Foundry. Returns compilation output including errors and warnings."

export const FOUNDRY_TEST_DESCRIPTION = `Run Foundry tests with specified verbosity. Use for PoC validation.

Verbosity levels:
- 1 (-v): Test names only
- 2 (-vv): Log emits  
- 3 (-vvv): Stack traces for failures (recommended)
- 4 (-vvvv): Full stack traces
- 5 (-vvvvv): Debug mode with all traces`

export const FOUNDRY_COVERAGE_DESCRIPTION =
  "Generate code coverage report for Solidity contracts."

export const CAST_CALL_DESCRIPTION =
  "Call a contract function without sending a transaction (read-only). Useful for checking state during audit."

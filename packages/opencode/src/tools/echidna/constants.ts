export const ECHIDNA_DESCRIPTION = `Run Echidna property-based fuzzing on a contract and report which invariants/properties hold vs. were falsified (with the breaking call sequence).

Echidna fuzzes \`echidna_*\` property functions (and assertions) to find inputs/sequences that
violate an invariant — excellent for accounting/access-control/state-machine invariants that
static tools miss. A FALSIFIED property comes with the concrete call sequence that breaks it.
Requires \`echidna\` (+ crytic-compile/solc); runs through the sandboxed runner. Fuzzing is
long-running — the runner enforces a hard wall-clock cap. Returns an install hint when absent.`

export const ECHIDNA_TIMEOUT_MS = 900_000

export const DEFAULT_TEST_LIMIT = 50_000

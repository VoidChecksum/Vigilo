export const HALMOS_DESCRIPTION = `Run Halmos symbolic testing on the project's \`check_*\`/\`test_*\` functions and report which symbolic properties hold vs. which have counterexamples.

Halmos symbolically executes Foundry tests: a FAILED test means it found concrete inputs that
violate the asserted property (a candidate bug, with the counterexample shown); a PASSED test
means the property held over the explored paths. Great for proving invariants (no overflow,
access-control holds, accounting balances). Requires \`halmos\` and Foundry; runs through the
sandboxed runner. Returns an install hint when absent.`

/** Symbolic execution can be slow; the runner enforces this hard wall-clock cap. */
export const HALMOS_TIMEOUT_MS = 900_000

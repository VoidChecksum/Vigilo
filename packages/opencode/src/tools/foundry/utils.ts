import { runCommand as runSandboxed, type RunCommandResult } from "../../shared/exec"

/** Default wall-clock budget for Foundry commands (forge test can fuzz). */
export const FOUNDRY_TIMEOUT_MS = 300_000

export interface RunForgeOptions {
  /** Working directory to pin execution to (the audit workspace). */
  cwd: string
  /** Override the default timeout. */
  timeoutMs?: number
  /** Extra env keys to expose (e.g. a vetted RPC URL var). */
  allowEnvKeys?: string[]
}

/**
 * Run a Foundry/`cast` command through the sandboxed runner: pinned cwd,
 * timeout, output cap, and scrubbed environment. Returns the full result so
 * callers can surface timeouts/truncation.
 */
export async function runCommand(
  cmdArgs: string[],
  opts: RunForgeOptions
): Promise<RunCommandResult> {
  return runSandboxed({
    argv: cmdArgs,
    cwd: opts.cwd,
    timeoutMs: opts.timeoutMs ?? FOUNDRY_TIMEOUT_MS,
    allowEnvKeys: opts.allowEnvKeys,
  })
}

export function parseTestSummary(stdout: string): { passed: number; failed: number } {
  const passMatch = stdout.match(/(\d+) tests? passed/)
  const failMatch = stdout.match(/(\d+) tests? failed/)
  return {
    passed: passMatch ? parseInt(passMatch[1]) : 0,
    failed: failMatch ? parseInt(failMatch[1]) : 0,
  }
}

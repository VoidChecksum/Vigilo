/**
 * Sandboxed command runner — the single execution surface for every external
 * binary Vigilo invokes (forge, cast, ast-grep, slither, …).
 *
 * Auditing runs UNTRUSTED code: `forge test` compiles and executes
 * attacker-supplied contest Solidity (which can reach the network/host via
 * Foundry `ffi`/RPC), and `cast` can hit arbitrary RPC endpoints. Spawning
 * those with the operator's full environment, no working-directory pin, no
 * timeout and no output cap is "running untrusted code on the host."
 *
 * Every call therefore gets, by construction:
 *   - a MANDATORY `cwd` pinned to the audit workspace,
 *   - a hard wall-clock timeout; on expiry the whole process GROUP is killed
 *     (POSIX), so children the tool forks (forge→solc, slither→solc, echidna
 *     workers, SMT solvers) are reaped too rather than orphaned,
 *   - an output cap per stream that bounds PEAK MEMORY: each stream is drained
 *     incrementally and accumulation stops once the cap is hit (the producer is
 *     killed), so a flood of untrusted output cannot OOM the host,
 *   - a SCRUBBED environment — only PATH/HOME/locale + an explicit allowlist
 *     are exposed, so unrelated secrets (API keys, cloud creds, tokens) never
 *     leak into untrusted execution.
 *
 * No shell is used: arguments are passed as an argv array, so there is no shell
 * interpolation/injection surface.
 */

import { spawn } from "bun"

export const DEFAULT_EXEC_TIMEOUT_MS = 300_000 // 5 minutes
export const DEFAULT_EXEC_MAX_OUTPUT_BYTES = 1 * 1024 * 1024 // 1 MiB per stream

/** Environment variables always passed through (needed for any tool to run). */
const ALWAYS_PASS_ENV = ["PATH", "HOME", "LANG", "LC_ALL", "LC_CTYPE", "TERM", "TMPDIR", "TZ"]

/** Prefixes of environment variables considered safe/relevant for the toolchain. */
const SAFE_ENV_PREFIXES = ["FOUNDRY_", "DAPP_", "SOLC_", "SVM_"]

export interface RunCommandOptions {
  /** [binary, ...args]. No shell — passed directly to the OS. Must be non-empty. */
  argv: string[]
  /** Working directory the command is pinned to. REQUIRED (the audit workspace). */
  cwd: string
  /** Wall-clock timeout in ms; the process is killed on expiry. */
  timeoutMs?: number
  /** Max bytes captured per stream; output beyond this is truncated with a marker. */
  maxOutputBytes?: number
  /** Explicit env overrides merged on top of the scrubbed base env. */
  env?: Record<string, string>
  /**
   * Additional process.env keys to pass through (beyond the always-on set and
   * SAFE_ENV_PREFIXES) — e.g. a specific RPC URL var the caller has vetted.
   */
  allowEnvKeys?: string[]
  /** Optional stdin written to the process. */
  input?: string
}

export interface RunCommandResult {
  stdout: string
  stderr: string
  /** Process exit code, or 127 when the binary could not be spawned. */
  exitCode: number
  /** True if the process was killed because it exceeded the timeout. */
  timedOut: boolean
  /** True if output was capped or the run timed out. */
  truncated: boolean
  truncatedReason?: "timeout" | "output-limit"
  durationMs: number
  /** Populated when the command could not be spawned (e.g. binary missing). */
  error?: string
}

/** Build a minimal, scrubbed environment for an untrusted-code execution. */
function buildScrubbedEnv(opts: RunCommandOptions): Record<string, string> {
  const env: Record<string, string> = {}

  for (const key of ALWAYS_PASS_ENV) {
    const v = process.env[key]
    if (v !== undefined) env[key] = v
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue
    if (SAFE_ENV_PREFIXES.some((p) => key.startsWith(p))) env[key] = value
  }

  for (const key of opts.allowEnvKeys ?? []) {
    const v = process.env[key]
    if (v !== undefined) env[key] = v
  }

  // Explicit overrides win.
  Object.assign(env, opts.env ?? {})

  return env
}

/**
 * Drain a byte stream while keeping at most `maxBytes` of it in memory. Once the
 * cap is exceeded we stop accumulating and invoke `onOverflow` (so the caller can
 * kill the producing process), then keep reading and discarding so the pipe can
 * close cleanly. Unlike buffering the whole stream and slicing afterwards, this
 * bounds PEAK memory — an untrusted child cannot OOM the host by flooding output.
 */
async function readCapped(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
  onOverflow: () => void,
): Promise<{ text: string; truncated: boolean }> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let truncated = false
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (truncated) continue // already over cap: drain and discard
      if (total + value.length <= maxBytes) {
        chunks.push(value)
        total += value.length
      } else {
        const remaining = maxBytes - total
        if (remaining > 0) chunks.push(value.subarray(0, remaining))
        total = maxBytes
        truncated = true
        onOverflow()
      }
    }
  } finally {
    reader.releaseLock()
  }
  const text = Buffer.concat(chunks.map((c) => Buffer.from(c)), total).toString("utf8")
  return truncated
    ? { text: `${text}\n\n[output truncated at ${maxBytes} bytes]`, truncated: true }
    : { text, truncated: false }
}

/**
 * Run an external command safely. Never throws for command-level failures —
 * a non-zero exit, a timeout, or a missing binary all come back as a populated
 * {@link RunCommandResult}.
 */
export async function runCommand(opts: RunCommandOptions): Promise<RunCommandResult> {
  if (!opts.argv || opts.argv.length === 0) {
    throw new Error("runCommand: argv must be a non-empty [binary, ...args] array")
  }
  if (!opts.cwd) {
    throw new Error("runCommand: cwd is required — pin execution to the audit workspace")
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_EXEC_TIMEOUT_MS
  const maxOutputBytes = opts.maxOutputBytes ?? DEFAULT_EXEC_MAX_OUTPUT_BYTES
  const env = buildScrubbedEnv(opts)
  const start = Date.now()

  let proc: ReturnType<typeof spawn>
  try {
    proc = spawn(opts.argv, {
      cwd: opts.cwd,
      env,
      stdin: opts.input ? new TextEncoder().encode(opts.input) : undefined,
      stdout: "pipe",
      stderr: "pipe",
      // POSIX: start the child as its own process-group leader (setsid) so a
      // timeout/overflow kill can target the whole group (`kill(-pid)`) and reap
      // grandchildren (solc, crytic-compile, SMT solvers) instead of orphaning them.
      ...(process.platform !== "win32" ? { detached: true } : {}),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      stdout: "",
      stderr: message,
      exitCode: 127,
      timedOut: false,
      truncated: false,
      durationMs: Date.now() - start,
      error: message,
    }
  }

  // Signal the child's whole process group on POSIX (the child is a group leader
  // via `detached`), falling back to the single child. No-op once it has exited.
  const killGroup = (signal: NodeJS.Signals) => {
    try {
      if (process.platform !== "win32" && proc.pid > 0) {
        process.kill(-proc.pid, signal)
      } else {
        proc.kill(signal)
      }
    } catch {
      try {
        proc.kill(signal)
      } catch {
        /* already exited */
      }
    }
  }

  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    killGroup("SIGTERM")
  }, timeoutMs)

  // Ensure a hung process group is force-killed shortly after a soft kill.
  const hardKill = setTimeout(() => {
    killGroup("SIGKILL")
  }, timeoutMs + 5_000)

  try {
    // stdout/stderr are always "pipe" (ReadableStream) above; Bun widens the
    // type when stdin is a union, so narrow it back for the reader. Each stream
    // is capped during accumulation; on overflow we kill the producing group.
    const killForOverflow = () => killGroup("SIGKILL")
    const [out, err] = await Promise.all([
      readCapped(proc.stdout as ReadableStream<Uint8Array>, maxOutputBytes, killForOverflow),
      readCapped(proc.stderr as ReadableStream<Uint8Array>, maxOutputBytes, killForOverflow),
    ])
    const exitCode = await proc.exited
    clearTimeout(timer)
    clearTimeout(hardKill)

    const truncated = timedOut || out.truncated || err.truncated
    const truncatedReason = timedOut
      ? "timeout"
      : out.truncated || err.truncated
        ? "output-limit"
        : undefined

    return {
      stdout: out.text,
      stderr: timedOut
        ? `${err.text}${err.text ? "\n" : ""}[killed: exceeded ${timeoutMs}ms timeout]`
        : err.text,
      exitCode,
      timedOut,
      truncated,
      truncatedReason,
      durationMs: Date.now() - start,
    }
  } catch (e) {
    clearTimeout(timer)
    clearTimeout(hardKill)
    const message = e instanceof Error ? e.message : String(e)
    return {
      stdout: "",
      stderr: message,
      exitCode: 1,
      timedOut,
      truncated: timedOut,
      truncatedReason: timedOut ? "timeout" : undefined,
      durationMs: Date.now() - start,
      error: message,
    }
  }
}

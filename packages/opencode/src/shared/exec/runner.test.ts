import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { runCommand } from "./runner"
import { tmpdir } from "os"
import { mkdtempSync, rmSync } from "fs"
import { join } from "path"

describe("sandboxed command runner", () => {
  let workdir: string

  beforeAll(() => {
    workdir = mkdtempSync(join(tmpdir(), "vigilo-exec-"))
  })

  afterAll(() => {
    rmSync(workdir, { recursive: true, force: true })
  })

  describe("#given a normal command", () => {
    test("#then captures stdout and exit code 0", async () => {
      const r = await runCommand({ argv: ["echo", "hello world"], cwd: workdir })
      expect(r.exitCode).toBe(0)
      expect(r.stdout).toContain("hello world")
      expect(r.timedOut).toBe(false)
      expect(r.truncated).toBe(false)
    })

    test("#then captures a non-zero exit code without throwing", async () => {
      const r = await runCommand({ argv: ["false"], cwd: workdir })
      expect(r.exitCode).not.toBe(0)
      expect(r.timedOut).toBe(false)
    })
  })

  describe("#given a required-argument violation", () => {
    test("#then throws when cwd is missing", async () => {
      await expect(
        runCommand({ argv: ["echo", "x"], cwd: "" })
      ).rejects.toThrow(/cwd is required/)
    })

    test("#then throws when argv is empty", async () => {
      await expect(runCommand({ argv: [], cwd: workdir })).rejects.toThrow(/argv/)
    })
  })

  describe("#given cwd pinning", () => {
    test("#then the process runs in the pinned working directory", async () => {
      const r = await runCommand({ argv: ["pwd"], cwd: workdir })
      // macOS tmp paths are symlinked (/var -> /private/var); match the leaf.
      expect(r.stdout.trim()).toContain(workdir.split("/").pop()!)
    })
  })

  describe("#given a command that exceeds the timeout", () => {
    test("#then it is killed and flagged timedOut", async () => {
      const r = await runCommand({
        argv: ["sleep", "10"],
        cwd: workdir,
        timeoutMs: 300,
      })
      expect(r.timedOut).toBe(true)
      expect(r.truncated).toBe(true)
      expect(r.truncatedReason).toBe("timeout")
      expect(r.durationMs).toBeLessThan(9_000)
    })
  })

  describe("#given output larger than the cap", () => {
    test("#then stdout is truncated with a marker", async () => {
      // Emit ~50 KB; cap at 1 KB.
      const big = "A".repeat(50_000)
      const r = await runCommand({
        argv: ["printf", "%s", big],
        cwd: workdir,
        maxOutputBytes: 1024,
      })
      expect(r.truncated).toBe(true)
      expect(r.truncatedReason).toBe("output-limit")
      expect(r.stdout).toContain("[output truncated")
      expect(Buffer.byteLength(r.stdout, "utf8")).toBeLessThan(2048)
    })
  })

  describe("#given environment scrubbing", () => {
    const SECRET = "VIGILO_TEST_SECRET_DO_NOT_LEAK"
    const ALLOWED = "VIGILO_TEST_ALLOWED_KEY"

    beforeAll(() => {
      process.env[SECRET] = "super-secret-value"
      process.env[ALLOWED] = "allowed-value"
    })

    afterAll(() => {
      delete process.env[SECRET]
      delete process.env[ALLOWED]
    })

    test("#then unrelated secrets are NOT exposed to the child", async () => {
      const r = await runCommand({ argv: ["env"], cwd: workdir })
      expect(r.stdout).not.toContain(SECRET)
      expect(r.stdout).not.toContain("super-secret-value")
      // PATH is always passed through so binaries resolve.
      expect(r.stdout).toContain("PATH=")
    })

    test("#then explicitly allowlisted keys ARE exposed", async () => {
      const r = await runCommand({
        argv: ["env"],
        cwd: workdir,
        allowEnvKeys: [ALLOWED],
      })
      expect(r.stdout).toContain("allowed-value")
    })

    test("#then explicit env overrides are applied", async () => {
      const r = await runCommand({
        argv: ["env"],
        cwd: workdir,
        env: { VIGILO_OVERRIDE: "override-value" },
      })
      expect(r.stdout).toContain("override-value")
    })
  })

  describe("#given a missing binary", () => {
    test("#then returns exit 127 with an error instead of throwing", async () => {
      const r = await runCommand({
        argv: ["this-binary-does-not-exist-vigilo"],
        cwd: workdir,
      })
      expect(r.exitCode).toBe(127)
      expect(r.error).toBeTruthy()
    })
  })

  describe("#given argv with shell metacharacters", () => {
    test("#then they are passed literally (no shell interpolation)", async () => {
      const r = await runCommand({
        argv: ["echo", "$(touch pwned); `id`; a && b"],
        cwd: workdir,
      })
      expect(r.exitCode).toBe(0)
      // The literal string is echoed; nothing is executed.
      expect(r.stdout).toContain("$(touch pwned)")
    })
  })
})

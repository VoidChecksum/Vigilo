import { describe, test, expect } from "bun:test"
import { sha256, verifyAstGrepChecksum, AST_GREP_CHECKSUMS } from "./checksums"

describe("sha256", () => {
  test("matches the known NIST vector for 'abc'", () => {
    expect(sha256(Buffer.from("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )
  })
  test("is deterministic", () => {
    const b = Buffer.from("vigilo")
    expect(sha256(b)).toBe(sha256(b))
  })
})

describe("verifyAstGrepChecksum", () => {
  test("#given a pinned platform + wrong bytes #then mismatch (with expected)", () => {
    const r = verifyAstGrepChecksum("0.40.0", "linux-x64", Buffer.from("not the real zip"))
    expect(r.status).toBe("mismatch")
    expect(r.expected).toBe(AST_GREP_CHECKSUMS["0.40.0"]["linux-x64"])
    expect(r.actual).toHaveLength(64)
  })

  test("#given bytes that match the pin #then ok", () => {
    // Drive the 'ok' branch deterministically by pinning a temp entry to a known hash.
    const buf = Buffer.from("payload")
    AST_GREP_CHECKSUMS["test-version"] = { "linux-x64": sha256(buf) }
    const r = verifyAstGrepChecksum("test-version", "linux-x64", buf)
    expect(r.status).toBe("ok")
    delete AST_GREP_CHECKSUMS["test-version"]
  })

  test("#given an unpinned version #then unknown (downloader fails closed unless opted in)", () => {
    expect(verifyAstGrepChecksum("99.0.0", "linux-x64", Buffer.from("x")).status).toBe("unknown")
  })

  test("#given an unpinned platform #then unknown", () => {
    expect(verifyAstGrepChecksum("0.40.0", "plan9-foo", Buffer.from("x")).status).toBe("unknown")
  })

  test("#then 0.40.0 pins all 5 common platforms with 64-hex digests", () => {
    const pins = AST_GREP_CHECKSUMS["0.40.0"]
    for (const p of ["linux-x64", "linux-arm64", "darwin-arm64", "darwin-x64", "win32-x64"]) {
      expect(pins[p]).toMatch(/^[0-9a-f]{64}$/)
    }
  })
})

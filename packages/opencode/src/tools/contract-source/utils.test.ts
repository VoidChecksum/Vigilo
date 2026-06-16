import { describe, test, expect } from "bun:test"
import { parseEtherscanResponse, parseSourceCodeField, sanitize } from "./utils"

function esResponse(result: Record<string, unknown>) {
  return JSON.stringify({ status: "1", message: "OK", result: [result] })
}

describe("parseSourceCodeField", () => {
  test("#shape1 plain single-file source", () => {
    const files = parseSourceCodeField("pragma solidity ^0.8.0; contract A {}", "MyToken")
    expect(files).toEqual([{ path: "MyToken.sol", content: "pragma solidity ^0.8.0; contract A {}" }])
  })

  test("#shape2 double-brace-wrapped standard JSON input", () => {
    const std = { language: "Solidity", sources: { "src/A.sol": { content: "contract A {}" }, "src/B.sol": { content: "contract B {}" } }, settings: {} }
    const files = parseSourceCodeField(`{${JSON.stringify(std)}}`, "A")
    expect(files.map((f) => f.path).sort()).toEqual(["src/A.sol", "src/B.sol"])
    expect(files.find((f) => f.path === "src/A.sol")?.content).toBe("contract A {}")
  })

  test("#shape3 single-brace path->{content} map", () => {
    const map = { "X.sol": { content: "contract X {}" } }
    const files = parseSourceCodeField(JSON.stringify(map), "X")
    expect(files).toEqual([{ path: "X.sol", content: "contract X {}" }])
  })

  test("path traversal is sanitized", () => {
    expect(sanitize("../../etc/passwd")).toBe("etc/passwd")
    expect(sanitize("/abs/A.sol")).toBe("abs/A.sol")
  })
})

describe("parseEtherscanResponse", () => {
  test("#given verified multi-file #then files + metadata", () => {
    const std = { sources: { "C.sol": { content: "contract C {}" } } }
    const raw = esResponse({ SourceCode: `{${JSON.stringify(std)}}`, ContractName: "C", CompilerVersion: "v0.8.20+commit", Proxy: "0" })
    const r = parseEtherscanResponse(raw)
    expect(r.ok).toBe(true)
    expect(r.verified).toBe(true)
    expect(r.name).toBe("C")
    expect(r.compiler).toContain("0.8.20")
    expect(r.files).toHaveLength(1)
  })

  test("#given a proxy #then flags proxy + implementation", () => {
    const raw = esResponse({ SourceCode: "contract P {}", ContractName: "P", Proxy: "1", Implementation: "0x1111111111111111111111111111111111111111" })
    const r = parseEtherscanResponse(raw)
    expect(r.proxy).toBe(true)
    expect(r.implementation).toBe("0x1111111111111111111111111111111111111111")
  })

  test("#given unverified (empty SourceCode) #then verified=false, no files", () => {
    const r = parseEtherscanResponse(esResponse({ SourceCode: "", ContractName: "" }))
    expect(r.verified).toBe(false)
    expect(r.files).toHaveLength(0)
    expect(r.error).toContain("not verified")
  })

  test("#given a string result (rate limit/bad key) #then error", () => {
    const r = parseEtherscanResponse(JSON.stringify({ status: "0", message: "NOTOK", result: "Max rate limit reached" }))
    expect(r.ok).toBe(false)
    expect(r.error).toContain("Max rate limit")
  })

  test("#given invalid JSON #then error", () => {
    expect(parseEtherscanResponse("<html>").ok).toBe(false)
  })
})

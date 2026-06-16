import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { KnowledgeGraphStore } from "./store"
import { ingestSlitherFindings } from "./ingest"
import type { SlitherFinding } from "../slither/types"

const PROV = { auditor: "slither", session: "s1" }

const finding = (over: Partial<SlitherFinding>): SlitherFinding => ({
  check: over.check ?? "reentrancy-eth",
  impact: over.impact ?? "High",
  confidence: over.confidence ?? "Medium",
  description: over.description ?? "desc",
  file: over.file ?? "src/Vault.sol",
  lines: over.lines ?? [42],
})

describe("ingestSlitherFindings", () => {
  let dir: string
  let kg: KnowledgeGraphStore

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "vigilo-ingest-"))
    kg = new KnowledgeGraphStore(dir)
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  test("#given slither findings #then creates Finding/Vulnerability/Contract nodes + edges", () => {
    const res = ingestSlitherFindings(kg, [finding({})], PROV)
    expect(res.findings).toBe(1)

    const findings = kg.queryNodes({ type: "Finding" })
    expect(findings).toHaveLength(1)
    expect(findings[0].props.source).toBe("slither")
    expect(findings[0].props.evidenceTier).toBe("STATIC_SUGGESTED")
    expect(findings[0].provenance.auditor).toBe("slither")

    expect(kg.queryNodes({ type: "Vulnerability", where: { key: "reentrancy-eth" } })).toHaveLength(1)
    expect(kg.queryNodes({ type: "Contract", where: { key: "src/Vault.sol" } })).toHaveLength(1)
    expect(kg.queryEdges({ type: "EXPLOITS" })).toHaveLength(1)
    expect(kg.queryEdges({ type: "AFFECTS" })).toHaveLength(1)
  })

  test("#given the same finding ingested twice #then it dedups (no duplicates)", () => {
    ingestSlitherFindings(kg, [finding({})], PROV)
    ingestSlitherFindings(kg, [finding({})], PROV)
    expect(kg.queryNodes({ type: "Finding" })).toHaveLength(1)
    expect(kg.queryEdges({ type: "AFFECTS" })).toHaveLength(1)
  })

  test("#given two checks on the same file #then distinct findings, shared Contract node", () => {
    ingestSlitherFindings(kg, [finding({ check: "reentrancy-eth", lines: [42] }), finding({ check: "unchecked-transfer", lines: [88] })], PROV)
    expect(kg.queryNodes({ type: "Finding" })).toHaveLength(2)
    expect(kg.queryNodes({ type: "Contract" })).toHaveLength(1) // same file
    expect(kg.queryNodes({ type: "Vulnerability" })).toHaveLength(2)
  })
})

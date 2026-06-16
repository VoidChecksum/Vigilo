import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { KnowledgeGraphStore } from "./store"

const PROV = { auditor: "reentrancy-auditor", session: "ses_1" }

describe("KnowledgeGraphStore", () => {
  let dir: string
  let kg: KnowledgeGraphStore

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "vigilo-kg-"))
    kg = new KnowledgeGraphStore(dir)
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  test("#given an empty store #then load returns no nodes/edges", () => {
    expect(kg.load()).toEqual({ nodes: [], edges: [] })
  })

  test("#given a recorded node #then it persists with deterministic id + provenance", () => {
    const n = kg.recordNode({ type: "Contract", key: "Vault", props: { file: "src/Vault.sol" } }, PROV)
    expect(n.id).toBe("Contract:Vault")
    expect(n.provenance.auditor).toBe("reentrancy-auditor")
    expect(n.provenance.recordedAt).toBeTruthy()
    const reloaded = new KnowledgeGraphStore(dir).load()
    expect(reloaded.nodes).toHaveLength(1)
    expect(reloaded.nodes[0].props.file).toBe("src/Vault.sol")
  })

  test("#given the same node recorded twice #then it dedups and merges props", () => {
    kg.recordNode({ type: "Finding", key: "VIG-001", props: { severity: "High" } }, PROV)
    kg.recordNode({ type: "Finding", key: "VIG-001", props: { status: "validated" } }, PROV)
    const nodes = kg.queryNodes({ type: "Finding" })
    expect(nodes).toHaveLength(1)
    expect(nodes[0].props).toEqual({ severity: "High", status: "validated" })
  })

  test("#then provenance cannot be overridden via props", () => {
    const n = kg.recordNode(
      { type: "Contract", key: "X", props: { provenance: "FAKE", auditor: "attacker" } },
      PROV
    )
    expect(n.provenance.auditor).toBe("reentrancy-auditor") // runtime-set, not from props
  })

  test("#given edges #then queryEdges filters by type/from/to", () => {
    kg.recordEdge({ type: "ENABLES", from: "Finding:VIG-001", to: "Finding:VIG-002" }, PROV)
    kg.recordEdge({ type: "AFFECTS", from: "Finding:VIG-001", to: "Contract:Vault" }, PROV)
    expect(kg.queryEdges({ type: "ENABLES" })).toHaveLength(1)
    expect(kg.queryEdges({ from: "Finding:VIG-001" })).toHaveLength(2)
    expect(kg.queryEdges({ to: "Contract:Vault" })).toHaveLength(1)
  })

  test("#given a chain of ENABLES/CAUSES #then chains() returns the path", () => {
    kg.recordEdge({ type: "ENABLES", from: "Finding:A", to: "Finding:B" }, PROV)
    kg.recordEdge({ type: "CAUSES", from: "Finding:B", to: "Asset:ETH" }, PROV)
    const paths = kg.chains("Finding:A")
    expect(paths).toContainEqual(["Finding:A", "Finding:B", "Asset:ETH"])
  })

  test("#given a cycle #then chains() terminates without infinite loop", () => {
    kg.recordEdge({ type: "ENABLES", from: "Finding:A", to: "Finding:B" }, PROV)
    kg.recordEdge({ type: "ENABLES", from: "Finding:B", to: "Finding:A" }, PROV)
    const paths = kg.chains("Finding:A", ["ENABLES"], 8)
    expect(paths.length).toBeGreaterThan(0)
    // No path repeats a node.
    for (const p of paths) expect(new Set(p).size).toBe(p.length)
  })

  test("#given an edge recorded twice #then it dedups", () => {
    kg.recordEdge({ type: "ENABLES", from: "Finding:A", to: "Finding:B", props: { a: 1 } }, PROV)
    kg.recordEdge({ type: "ENABLES", from: "Finding:A", to: "Finding:B", props: { b: 2 } }, PROV)
    const edges = kg.queryEdges({ type: "ENABLES" })
    expect(edges).toHaveLength(1)
    expect(edges[0].props).toEqual({ a: 1, b: 2 })
  })

  test("#given a where filter #then queryNodes matches props and key", () => {
    kg.recordNode({ type: "Finding", key: "VIG-001", props: { severity: "High" } }, PROV)
    kg.recordNode({ type: "Finding", key: "VIG-002", props: { severity: "Low" } }, PROV)
    expect(kg.queryNodes({ type: "Finding", where: { severity: "High" } })).toHaveLength(1)
    expect(kg.queryNodes({ where: { key: "VIG-002" } })).toHaveLength(1)
  })
})

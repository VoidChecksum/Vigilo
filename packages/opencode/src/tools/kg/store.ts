import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type {
  KGData,
  KGNode,
  KGEdge,
  NodeInput,
  EdgeInput,
  Provenance,
  GraphRelationshipType,
} from "./types"
import { nodeId, edgeId } from "./types"

/** Edge types that compose multi-step attack chains. */
export const CHAIN_EDGE_TYPES: GraphRelationshipType[] = ["ENABLES", "CAUSES", "REQUIRES"]

/**
 * File-based knowledge-graph store at `.vigilo/kg/` (JSONL: `nodes.jsonl`,
 * `edges.jsonl`). This is the real, queryable substrate behind the conceptual
 * graph model — no external database. Nodes/edges are deduplicated by
 * deterministic identity (props merge on re-record), and every record carries
 * runtime-set provenance.
 *
 * Data volumes for a single-target audit are small, so the store loads, mutates,
 * and rewrites whole files — simple and correct over append-with-compaction.
 */
export class KnowledgeGraphStore {
  private readonly nodesPath: string
  private readonly edgesPath: string

  constructor(private readonly dir: string) {
    this.nodesPath = join(dir, "nodes.jsonl")
    this.edgesPath = join(dir, "edges.jsonl")
  }

  /** Load and dedup the whole graph (last-write-wins on identity, props merged). */
  load(): KGData {
    const nodes = dedupeById(readJsonl<KGNode>(this.nodesPath))
    const edges = dedupeById(readJsonl<KGEdge>(this.edgesPath))
    return { nodes, edges }
  }

  recordNode(input: NodeInput, prov: Omit<Provenance, "recordedAt">): KGNode {
    const id = nodeId(input.type, input.key)
    const data = this.load()
    const existing = data.nodes.find((n) => n.id === id)
    const node: KGNode = {
      id,
      type: input.type,
      key: input.key,
      props: { ...(existing?.props ?? {}), ...(input.props ?? {}) },
      provenance: { ...prov, recordedAt: nowIso() },
    }
    const nodes = upsert(data.nodes, node)
    this.writeNodes(nodes)
    return node
  }

  recordEdge(input: EdgeInput, prov: Omit<Provenance, "recordedAt">): KGEdge {
    const id = edgeId(input.from, input.type, input.to)
    const data = this.load()
    const existing = data.edges.find((e) => e.id === id)
    const edge: KGEdge = {
      id,
      type: input.type,
      from: input.from,
      to: input.to,
      props: { ...(existing?.props ?? {}), ...(input.props ?? {}) },
      provenance: { ...prov, recordedAt: nowIso() },
    }
    const edges = upsert(data.edges, edge)
    this.writeEdges(edges)
    return edge
  }

  queryNodes(filter?: { type?: string; where?: Record<string, unknown> }): KGNode[] {
    return this.load().nodes.filter((n) => {
      if (filter?.type && n.type !== filter.type) return false
      if (filter?.where) {
        for (const [k, v] of Object.entries(filter.where)) {
          const actual = k === "key" ? n.key : n.props[k]
          if (actual !== v) return false
        }
      }
      return true
    })
  }

  queryEdges(filter?: { type?: string; from?: string; to?: string }): KGEdge[] {
    return this.load().edges.filter((e) => {
      if (filter?.type && e.type !== filter.type) return false
      if (filter?.from && e.from !== filter.from) return false
      if (filter?.to && e.to !== filter.to) return false
      return true
    })
  }

  /**
   * Return all attack-chain paths starting at `startId`, following the given edge
   * types (default ENABLES/CAUSES/REQUIRES) up to `maxDepth`. Cycle-safe.
   */
  chains(
    startId: string,
    edgeTypes: GraphRelationshipType[] = CHAIN_EDGE_TYPES,
    maxDepth = 8
  ): string[][] {
    const { edges } = this.load()
    const allowed = new Set(edgeTypes)
    const out: string[][] = []

    const walk = (path: string[], visited: Set<string>) => {
      const tail = path[path.length - 1]
      const next = edges.filter((e) => e.from === tail && allowed.has(e.type) && !visited.has(e.to))
      if (next.length === 0) {
        if (path.length > 1) out.push(path)
        return
      }
      if (path.length >= maxDepth) {
        out.push(path)
        return
      }
      for (const e of next) {
        walk([...path, e.to], new Set([...visited, e.to]))
      }
    }

    walk([startId], new Set([startId]))
    return out
  }

  private writeNodes(nodes: KGNode[]): void {
    this.ensureDir()
    writeJsonl(this.nodesPath, nodes)
  }

  private writeEdges(edges: KGEdge[]): void {
    this.ensureDir()
    writeJsonl(this.edgesPath, edges)
  }

  private ensureDir(): void {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true })
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return []
  const out: T[] = []
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      out.push(JSON.parse(trimmed) as T)
    } catch {
      // Skip a corrupt line rather than failing the whole load.
    }
  }
  return out
}

function writeJsonl<T>(path: string, items: T[]): void {
  writeFileSync(path, items.map((i) => JSON.stringify(i)).join("\n") + (items.length ? "\n" : ""))
}

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  const idx = items.findIndex((i) => i.id === item.id)
  if (idx === -1) return [...items, item]
  const copy = [...items]
  copy[idx] = item
  return copy
}

/** Keep the last occurrence of each id, merging props of earlier ones under it. */
function dedupeById<T extends { id: string; props: Record<string, unknown> }>(items: T[]): T[] {
  const map = new Map<string, T>()
  for (const item of items) {
    const prev = map.get(item.id)
    map.set(item.id, prev ? { ...item, props: { ...prev.props, ...item.props } } : item)
  }
  return [...map.values()]
}

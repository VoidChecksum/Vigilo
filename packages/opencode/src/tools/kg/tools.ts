import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { join } from "node:path"
import { log } from "../../shared"
import { KnowledgeGraphStore, CHAIN_EDGE_TYPES } from "./store"
import { NODE_TYPES, EDGE_TYPES, isNodeType, isEdgeType } from "./types"
import type { GraphRelationshipType } from "./types"

interface ToolCtx {
  directory?: string
  sessionID?: string
  agent?: string
}

function storeFor(context: unknown): { store: KnowledgeGraphStore; prov: { auditor: string; session: string } } {
  const ctx = (context ?? {}) as ToolCtx
  const cwd = ctx.directory ?? process.cwd()
  return {
    store: new KnowledgeGraphStore(join(cwd, ".vigilo", "kg")),
    // Provenance is taken from the runtime context — never from LLM args.
    prov: { auditor: ctx.agent ?? "unknown", session: ctx.sessionID ?? "unknown" },
  }
}

export const kg_record: ToolDefinition = tool({
  description:
    "Record a node or edge in the audit knowledge graph (.vigilo/kg/). Nodes: " +
    `${NODE_TYPES.join(", ")}. Edges: ${EDGE_TYPES.join(", ")}. ` +
    "Nodes dedupe on (type, key); edges on (from, type, to); re-recording merges props. " +
    "Use it to map contracts/functions and to link findings into attack chains " +
    "(e.g. Finding A ENABLES Finding B CAUSES Asset loss). Provenance is recorded automatically.",
  args: {
    kind: tool.schema.enum(["node", "edge"]).describe("Record a 'node' or an 'edge'."),
    type: tool.schema.string().describe("Node type (e.g. Contract, Finding) or edge type (e.g. ENABLES, CAUSES)."),
    key: tool.schema.string().optional().describe("Node only: stable dedup key (e.g. contract name, finding id)."),
    from: tool.schema.string().optional().describe("Edge only: source node id (`Type:key`)."),
    to: tool.schema.string().optional().describe("Edge only: target node id (`Type:key`)."),
    props: tool.schema.record(tool.schema.string(), tool.schema.unknown()).optional().describe("Arbitrary properties."),
  },
  async execute(args, context) {
    log("kg_record", args)
    const { store, prov } = storeFor(context)

    if (args.kind === "node") {
      if (!args.key) return "kg_record: a node requires `key`."
      if (!isNodeType(args.type)) return `kg_record: invalid node type "${args.type}". Valid: ${NODE_TYPES.join(", ")}`
      const n = store.recordNode({ type: args.type, key: args.key, props: args.props }, prov)
      return `Recorded node ${n.id}`
    }

    if (!args.from || !args.to) return "kg_record: an edge requires `from` and `to` node ids."
    if (!isEdgeType(args.type)) return `kg_record: invalid edge type "${args.type}". Valid: ${EDGE_TYPES.join(", ")}`
    const e = store.recordEdge({ type: args.type, from: args.from, to: args.to, props: args.props }, prov)
    return `Recorded edge ${e.id}`
  },
})

export const kg_query: ToolDefinition = tool({
  description:
    "Query the audit knowledge graph (.vigilo/kg/). List nodes by type/property or edges by " +
    "type/endpoint — e.g. 'all High findings', 'what AFFECTS Vault'. Returns JSON.",
  args: {
    kind: tool.schema.enum(["nodes", "edges"]).describe("Query 'nodes' or 'edges'."),
    type: tool.schema.string().optional().describe("Filter by node/edge type."),
    where: tool.schema.record(tool.schema.string(), tool.schema.unknown()).optional().describe("Nodes only: match these props (or `key`)."),
    from: tool.schema.string().optional().describe("Edges only: source node id."),
    to: tool.schema.string().optional().describe("Edges only: target node id."),
  },
  async execute(args, context) {
    log("kg_query", args)
    const { store } = storeFor(context)
    const results =
      args.kind === "nodes"
        ? store.queryNodes({ type: args.type, where: args.where })
        : store.queryEdges({ type: args.type, from: args.from, to: args.to })
    if (results.length === 0) return "No matching results."
    return `${results.length} result(s):\n${JSON.stringify(results, null, 2).slice(0, 20000)}`
  },
})

export const kg_chain: ToolDefinition = tool({
  description:
    "Trace attack chains from a node through ENABLES/CAUSES/REQUIRES edges in the knowledge " +
    "graph — surfaces multi-step exploits a flat finding list misses (e.g. an unguarded setter " +
    "ENABLES an oracle swap that CAUSES a mispriced liquidation). Cycle-safe.",
  args: {
    start: tool.schema.string().describe("Starting node id (`Type:key`), e.g. `Finding:VIG-001`."),
    edge_types: tool.schema.array(tool.schema.string()).optional().describe(`Edge types to follow (default: ${CHAIN_EDGE_TYPES.join("/")}).`),
    max_depth: tool.schema.number().optional().describe("Max chain length (default 8)."),
  },
  async execute(args, context) {
    log("kg_chain", args)
    const { store } = storeFor(context)
    const edgeTypes = (args.edge_types?.filter(isEdgeType) as GraphRelationshipType[]) ?? undefined
    const paths = store.chains(args.start, edgeTypes, args.max_depth ?? 8)
    if (paths.length === 0) return `No attack chains found from ${args.start}.`
    const lines = paths
      .sort((a, b) => b.length - a.length)
      .slice(0, 50)
      .map((p) => `- ${p.join(" -> ")}`)
    return `${paths.length} chain(s) from ${args.start}:\n${lines.join("\n")}`
  },
})

export const kgTools: Record<string, ToolDefinition> = { kg_record, kg_query, kg_chain }

import type { GraphNodeType, GraphRelationshipType } from "../../agents/types"

export type { GraphNodeType, GraphRelationshipType }

/**
 * Provenance is set by the runtime (auditor/session from tool context, timestamp
 * by the store) — NEVER taken from LLM-supplied props. This keeps the graph's
 * audit trail trustworthy.
 */
export interface Provenance {
  auditor: string
  session: string
  recordedAt: string
}

export interface KGNode {
  /** Deterministic identity: `${type}:${key}`. */
  id: string
  type: GraphNodeType
  /** Stable dedup key within a type (e.g. contract name, finding id, vuln class). */
  key: string
  props: Record<string, unknown>
  provenance: Provenance
}

export interface KGEdge {
  /** Deterministic identity: `${from}|${type}|${to}`. */
  id: string
  type: GraphRelationshipType
  from: string
  to: string
  props: Record<string, unknown>
  provenance: Provenance
}

export interface KGData {
  nodes: KGNode[]
  edges: KGEdge[]
}

export interface NodeInput {
  type: GraphNodeType
  key: string
  props?: Record<string, unknown>
}

export interface EdgeInput {
  type: GraphRelationshipType
  /** Source node id (`${type}:${key}`) or a `{type, key}` pair. */
  from: string
  to: string
  props?: Record<string, unknown>
}

/** Runtime lists kept aligned with the canonical unions (compile error if they drift). */
export const NODE_TYPES = [
  "Contract", "Function", "Vulnerability", "Finding", "Attacker",
  "Admin", "Asset", "Oracle", "Bridge", "External", "Pattern", "State",
] as const satisfies readonly GraphNodeType[]

export const EDGE_TYPES = [
  "CALLS", "READS", "WRITES", "CONTROLS", "OWNS", "TRANSFERS", "EXPLOITS",
  "CAUSES", "REQUIRES", "ENABLES", "MITIGATES", "CHECKS", "USES_ORACLE",
  "BRIDGES_TO", "DEPENDS_ON", "INHERITS", "IMPLEMENTS", "USES_LIB", "AFFECTS", "CONTAINS",
] as const satisfies readonly GraphRelationshipType[]

export function isNodeType(s: string): s is GraphNodeType {
  return (NODE_TYPES as readonly string[]).includes(s)
}

export function isEdgeType(s: string): s is GraphRelationshipType {
  return (EDGE_TYPES as readonly string[]).includes(s)
}

export function nodeId(type: GraphNodeType, key: string): string {
  return `${type}:${key}`
}

export function edgeId(from: string, type: GraphRelationshipType, to: string): string {
  return `${from}|${type}|${to}`
}

import { KnowledgeGraphStore } from "./store"
import { nodeId } from "./types"
import type { SlitherFinding } from "../slither/types"
import type { MythrilFinding } from "../mythril/types"

export interface IngestProvenance {
  auditor: string
  session: string
}

export interface IngestResult {
  findings: number
}

/** Normalized static-analysis finding fed into the knowledge graph. */
export interface StaticFinding {
  /** Detector/title (e.g. "reentrancy-eth", "Integer Arithmetic Bugs"). */
  check: string
  /** Severity/impact label (High/Medium/Low/…). */
  impact: string
  confidence?: string
  file: string | null
  line?: number
  /** Vulnerability-class key for the Vulnerability node (e.g. SWC id); defaults to `check`. */
  vulnClass?: string
  /** Tool that produced it ("slither", "mythril", …). */
  source: string
}

/**
 * Lift normalized static-analysis findings into the knowledge graph (tooling→memory loop).
 * Each becomes a `Finding` node tagged `STATIC_SUGGESTED` (a hint, not a confirmed bug),
 * linked to a `Vulnerability` class node (EXPLOITS) and the affected `Contract` file node
 * (AFFECTS). Deterministic keys mean re-running a tool updates in place, not duplicates.
 */
export function ingestStaticFindings(
  store: KnowledgeGraphStore,
  findings: StaticFinding[],
  prov: IngestProvenance
): IngestResult {
  for (const f of findings) {
    const fileKey = f.file ?? "unknown"
    const line = f.line ?? 0
    const findingKey = `${f.source}:${f.check}:${fileKey}:${line}`
    const vulnKey = f.vulnClass || f.check

    store.recordNode({ type: "Contract", key: fileKey, props: { file: fileKey } }, prov)
    store.recordNode({ type: "Vulnerability", key: vulnKey, props: { type: vulnKey } }, prov)
    store.recordNode(
      {
        type: "Finding",
        key: findingKey,
        props: {
          check: f.check,
          impact: f.impact,
          confidence: f.confidence,
          source: f.source,
          evidenceTier: "STATIC_SUGGESTED",
          line: f.line,
          file: fileKey,
        },
      },
      prov
    )

    store.recordEdge(
      { type: "EXPLOITS", from: nodeId("Finding", findingKey), to: nodeId("Vulnerability", vulnKey) },
      prov
    )
    store.recordEdge(
      { type: "AFFECTS", from: nodeId("Finding", findingKey), to: nodeId("Contract", fileKey) },
      prov
    )
  }
  return { findings: findings.length }
}

/** Ingest Slither findings (vuln class = the detector check). */
export function ingestSlitherFindings(
  store: KnowledgeGraphStore,
  findings: SlitherFinding[],
  prov: IngestProvenance
): IngestResult {
  return ingestStaticFindings(
    store,
    findings.map((f) => ({
      check: f.check,
      impact: f.impact,
      confidence: f.confidence,
      file: f.file,
      line: f.lines[0],
      vulnClass: f.check,
      source: "slither",
    })),
    prov
  )
}

/** Ingest Mythril findings (vuln class = SWC id when present). */
export function ingestMythrilFindings(
  store: KnowledgeGraphStore,
  findings: MythrilFinding[],
  prov: IngestProvenance
): IngestResult {
  return ingestStaticFindings(
    store,
    findings.map((f) => ({
      check: f.title,
      impact: f.severity,
      file: f.file,
      line: f.line ?? undefined,
      vulnClass: f.swc_id ?? f.title,
      source: "mythril",
    })),
    prov
  )
}

export * from "./constants"
export * from "./utils"

export { createReentrancyAuditor, REENTRANCY_AUDITOR_METADATA } from "./reentrancy-auditor"
export { createOracleAuditor, ORACLE_AUDITOR_METADATA } from "./oracle-auditor"
export { createAccessControlAuditor, ACCESS_CONTROL_AUDITOR_METADATA } from "./access-control-auditor"
export { createFlashloanAuditor, FLASHLOAN_AUDITOR_METADATA } from "./flashloan-auditor"
export { createLogicAuditor, LOGIC_AUDITOR_METADATA } from "./logic-auditor"
export { createDefiAuditor, DEFI_AUDITOR_METADATA } from "./defi-auditor"
export { createCrossChainAuditor, CROSS_CHAIN_AUDITOR_METADATA } from "./cross-chain-auditor"
export { createTokenAuditor, TOKEN_AUDITOR_METADATA } from "./token-auditor"

import type { AgentConfig } from "@opencode-ai/sdk"
import type { AuditorPromptMetadata, BuiltinAuditorName } from "../types"

import { createReentrancyAuditor, REENTRANCY_AUDITOR_METADATA } from "./reentrancy-auditor"
import { createOracleAuditor, ORACLE_AUDITOR_METADATA } from "./oracle-auditor"
import { createAccessControlAuditor, ACCESS_CONTROL_AUDITOR_METADATA } from "./access-control-auditor"
import { createFlashloanAuditor, FLASHLOAN_AUDITOR_METADATA } from "./flashloan-auditor"
import { createLogicAuditor, LOGIC_AUDITOR_METADATA } from "./logic-auditor"
import { createDefiAuditor, DEFI_AUDITOR_METADATA } from "./defi-auditor"
import { createCrossChainAuditor, CROSS_CHAIN_AUDITOR_METADATA } from "./cross-chain-auditor"
import { createTokenAuditor, TOKEN_AUDITOR_METADATA } from "./token-auditor"

export type AuditorFactory = (model?: string) => AgentConfig

/** Specialist auditors only — utility/infra agents (vigilo, quaestor, explorator, speculator, faber, sandbox, graph-builder, purifier, verifier, triage, validator) are in agents/ */
export type SpecialistAuditorName = Exclude<BuiltinAuditorName, "vigilo" | "quaestor" | "explorator" | "speculator" | "faber" | "sandbox" | "graph-builder" | "purifier" | "verifier" | "triage" | "validator">

/** A specialist auditor's single-point registration (Decepticon SubAgentSpec analogue). */
export interface AuditorSpec {
  name: SpecialistAuditorName
  factory: AuditorFactory
  metadata: AuditorPromptMetadata
}

/**
 * Single source of truth for the specialist auditor roster — adding an auditor is one
 * entry here, not parallel edits across several maps. The factory/metadata maps below
 * are derived from this list.
 */
export const AUDITOR_SPECS: AuditorSpec[] = [
  { name: "reentrancy-auditor", factory: createReentrancyAuditor, metadata: REENTRANCY_AUDITOR_METADATA },
  { name: "oracle-auditor", factory: createOracleAuditor, metadata: ORACLE_AUDITOR_METADATA },
  { name: "access-control-auditor", factory: createAccessControlAuditor, metadata: ACCESS_CONTROL_AUDITOR_METADATA },
  { name: "flashloan-auditor", factory: createFlashloanAuditor, metadata: FLASHLOAN_AUDITOR_METADATA },
  { name: "logic-auditor", factory: createLogicAuditor, metadata: LOGIC_AUDITOR_METADATA },
  { name: "defi-auditor", factory: createDefiAuditor, metadata: DEFI_AUDITOR_METADATA },
  { name: "cross-chain-auditor", factory: createCrossChainAuditor, metadata: CROSS_CHAIN_AUDITOR_METADATA },
  { name: "token-auditor", factory: createTokenAuditor, metadata: TOKEN_AUDITOR_METADATA },
]

export const AUDITOR_FACTORIES = Object.fromEntries(
  AUDITOR_SPECS.map((s) => [s.name, s.factory])
) as Record<SpecialistAuditorName, AuditorFactory>

export const AUDITOR_METADATA = Object.fromEntries(
  AUDITOR_SPECS.map((s) => [s.name, s.metadata])
) as Record<SpecialistAuditorName, AuditorPromptMetadata>

export function createAllAuditors(model?: string): Record<string, AgentConfig> {
  const result: Record<string, AgentConfig> = {}
  for (const [name, factory] of Object.entries(AUDITOR_FACTORIES)) {
    result[name] = factory(model)
  }
  return result
}

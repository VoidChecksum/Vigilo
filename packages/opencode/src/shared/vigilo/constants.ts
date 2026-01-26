import type { CategoryConfig, AgentDefinition } from "./types"

export const DEFAULT_CATEGORIES: Record<string, CategoryConfig> = {
  "recon": {
    model: "anthropic/claude-haiku-4-5",
    description: "Fast reconnaissance - code/docs analysis",
    prompt_append: "Focus on speed over depth. Map structure, flows, and patterns quickly.",
  },
  "deep-audit": {
    model: "anthropic/claude-sonnet-4-5",
    description: "Deep vulnerability analysis",
    prompt_append: "Thoroughly analyze for security vulnerabilities. Check all edge cases.",
  },
  "poc-validation": {
    model: "anthropic/claude-sonnet-4-5",
    description: "PoC generation and Foundry test validation",
    prompt_append: "Generate working PoC tests. Validate with forge test.",
  },
  "report": {
    model: "anthropic/claude-sonnet-4-5",
    description: "Security report generation",
    prompt_append: "Generate professional security audit reports.",
  },
}

export const DEFAULT_AGENTS: Record<string, AgentDefinition> = {
  "code-analyzer": {
    name: "code-analyzer",
    description: "Fast code reconnaissance specialist",
    model: "anthropic/claude-haiku-4-5",
    tools: ["Read", "Glob", "Grep", "Write"],
    skills: ["code-analysis"],
    color: "green",
  },
  "docs-analyzer": {
    name: "docs-analyzer",
    description: "Documentation analysis specialist",
    model: "anthropic/claude-haiku-4-5",
    tools: ["Read", "Glob", "Grep", "Write"],
    skills: ["docs-analysis"],
    color: "blue",
  },
  "reentrancy-auditor": {
    name: "reentrancy-auditor",
    description: "Reentrancy vulnerability detection specialist",
    model: "anthropic/claude-sonnet-4-5",
    tools: ["Read", "Glob", "Grep", "Write"],
    skills: ["reentrancy"],
    color: "red",
  },
  "oracle-auditor": {
    name: "oracle-auditor",
    description: "Oracle manipulation detection specialist",
    model: "anthropic/claude-sonnet-4-5",
    tools: ["Read", "Glob", "Grep", "Write"],
    skills: ["oracle"],
    color: "orange",
  },
  "access-control-auditor": {
    name: "access-control-auditor",
    description: "Access control vulnerability detection",
    model: "anthropic/claude-sonnet-4-5",
    tools: ["Read", "Glob", "Grep", "Write"],
    skills: ["access-control"],
    color: "purple",
  },
  "logic-auditor": {
    name: "logic-auditor",
    description: "Business logic vulnerability detection",
    model: "anthropic/claude-sonnet-4-5",
    tools: ["Read", "Glob", "Grep", "Write"],
    skills: ["logic-error"],
    color: "yellow",
  },
  "flashloan-auditor": {
    name: "flashloan-auditor",
    description: "Flash loan attack detection",
    model: "anthropic/claude-sonnet-4-5",
    tools: ["Read", "Glob", "Grep", "Write"],
    skills: ["flashloan"],
    color: "cyan",
  },
  "defi-auditor": {
    name: "defi-auditor",
    description: "DeFi-specific vulnerability detection",
    model: "anthropic/claude-sonnet-4-5",
    tools: ["Read", "Glob", "Grep", "Write"],
    skills: ["economic-attack"],
    color: "magenta",
  },
}

export const AUDITOR_SELECTION: Record<string, string[]> = {
  "amm": ["flashloan-auditor", "oracle-auditor", "reentrancy-auditor"],
  "dex": ["flashloan-auditor", "oracle-auditor", "reentrancy-auditor"],
  "lending": ["oracle-auditor", "logic-auditor", "flashloan-auditor"],
  "vault": ["logic-auditor", "reentrancy-auditor", "defi-auditor"],
  "erc4626": ["logic-auditor", "reentrancy-auditor", "defi-auditor"],
  "governance": ["flashloan-auditor", "access-control-auditor", "logic-auditor"],
  "bridge": ["access-control-auditor", "reentrancy-auditor", "logic-auditor"],
  "staking": ["logic-auditor", "reentrancy-auditor", "defi-auditor"],
  "token": ["access-control-auditor", "logic-auditor", "reentrancy-auditor"],
  "default": ["reentrancy-auditor", "access-control-auditor", "logic-auditor"],
}

export const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const

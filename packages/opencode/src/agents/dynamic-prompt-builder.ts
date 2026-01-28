/**
 * Dynamic Prompt Builder for Vigilo
 *
 * Generates prompt sections at runtime from available auditors, skills, and metadata.
 * Inspired by Oh-My-OpenCode's dynamic-agent-prompt-builder.ts
 *
 * Key principle: Adding a new auditor or skill should NOT require editing vigilo.ts.
 * Metadata drives prompt generation.
 */

import type { AvailableAuditor, AvailableSkill, AuditorPromptMetadata } from "./types"

// ---------------------------------------------------------------------------
// Auditor Selection Guide (dynamic)
// ---------------------------------------------------------------------------

export function buildAuditorSelectionGuide(auditors: AvailableAuditor[]): string {
  if (auditors.length === 0) return ""

  const recon = auditors.filter(a => a.metadata?.category === "recon")
  const specialists = auditors.filter(a => a.metadata?.category === "specialist")

  const reconRows = recon.map(a => {
    const shortDesc = a.description.split(".")[0] || a.description
    return `| \`${a.name}\` | ${a.metadata?.cost ?? "FAST"} | ${shortDesc} |`
  })

  const specialistRows = specialists.map(a => {
    const shortDesc = a.description.split(".")[0] || a.description
    const triggers = a.metadata?.triggers?.map(t => t.trigger).join(", ") ?? ""
    return `| \`${a.name}\` | ${a.metadata?.cost ?? "DEEP"} | ${shortDesc} | ${triggers} |`
  })

  return `<Auditor_Selection>
## Available Auditors

### Recon Agents (Phase 1)
| Auditor | Cost | Purpose |
|---------|------|---------|
${reconRows.join("\n")}

### Specialist Auditors (Phase 2)
| Auditor | Cost | Specialization | Triggers |
|---------|------|----------------|----------|
${specialistRows.join("\n")}

### When to Use Each Auditor
${specialists.map(a => {
    const useWhen = a.metadata?.useWhen ?? []
    const avoidWhen = a.metadata?.avoidWhen ?? []
    if (useWhen.length === 0 && avoidWhen.length === 0) return ""
    return `
**${a.name}**:
${useWhen.length > 0 ? `- USE WHEN: ${useWhen.join("; ")}` : ""}
${avoidWhen.length > 0 ? `- AVOID WHEN: ${avoidWhen.join("; ")}` : ""}`
  }).filter(Boolean).join("\n")}
</Auditor_Selection>`
}

// ---------------------------------------------------------------------------
// Skill Evaluation Guide (dynamic)
// ---------------------------------------------------------------------------

export function buildSkillEvaluationGuide(skills: AvailableSkill[]): string {
  if (skills.length === 0) return ""

  const skillRows = skills.map(s => {
    const shortDesc = s.description.split(".")[0] || s.description
    return `| \`${s.name}\` | ${shortDesc} |`
  })

  return `<Skill_Evaluation>
## Skill Selection Protocol (MANDATORY before every delegation)

### Available Skills
| Skill | Expertise Domain |
|-------|------------------|
${skillRows.join("\n")}

### MANDATORY Evaluation Steps

**STEP 1**: For EVERY skill above, ask:
> "Does this skill's domain overlap with the auditor's task?"
- YES → INCLUDE in delegation prompt as required skill
- NO → JUSTIFY why not

**STEP 2**: Justify Omissions
If you choose NOT to include a skill that MIGHT be relevant:
\`\`\`
SKILL EVALUATION for "[skill-name]":
- Skill domain: [what the skill covers]
- Auditor task: [what the auditor is analyzing]
- Decision: OMIT
- Reason: [specific explanation]
\`\`\`

**STEP 3**: Include in Delegation
\`\`\`
## 3. REQUIRED SKILLS
- [matched-skill-1]: [why it's relevant]
- [matched-skill-2]: [why it's relevant]

OMITTED SKILLS:
- [skill-name]: [justification]
\`\`\`

**WHY THIS IS MANDATORY**:
- Auditors are STATELESS - they don't know what skills exist unless you tell them
- Missing a relevant skill = auditor lacks domain-specific vulnerability patterns
- Empty skills without justification = ANTI-PATTERN
</Skill_Evaluation>`
}

// ---------------------------------------------------------------------------
// Protocol-Auditor Mapping (dynamic from metadata)
// ---------------------------------------------------------------------------

export function buildProtocolMappingFromMetadata(auditors: AvailableAuditor[]): string {
  const specialists = auditors.filter(a => a.metadata?.category === "specialist")
  if (specialists.length === 0) return ""

  // Build mapping from trigger metadata
  const protocolMap: Record<string, string[]> = {}
  for (const a of specialists) {
    for (const trigger of a.metadata?.triggers ?? []) {
      const proto = trigger.protocolType.toLowerCase()
      if (!protocolMap[proto]) protocolMap[proto] = []
      if (!protocolMap[proto].includes(a.name)) {
        protocolMap[proto].push(a.name)
      }
    }
  }

  // Remove "all" key - those apply everywhere
  const universalAuditors = protocolMap["all"] ?? []
  delete protocolMap["all"]

  const rows = Object.entries(protocolMap).map(([proto, auditorNames]) => {
    return `| ${proto} | ${auditorNames.join(", ")} |`
  })

  return `### Protocol → Auditor Mapping (auto-generated from metadata)

| Protocol | Recommended Auditors |
|----------|---------------------|
${rows.join("\n")}

**Universal auditors** (apply to ALL protocols): ${universalAuditors.join(", ") || "none"}

> This table is generated from auditor trigger metadata. Adding a new auditor with
> the right triggers automatically updates this mapping.`
}

// ---------------------------------------------------------------------------
// Delegation Trigger Guide (dynamic)
// ---------------------------------------------------------------------------

export function buildDelegationTriggerTable(auditors: AvailableAuditor[]): string {
  const rows: string[] = []
  for (const a of auditors) {
    for (const trigger of a.metadata?.triggers ?? []) {
      rows.push(`| ${trigger.protocolType} | \`${a.name}\` | ${trigger.trigger} |`)
    }
  }

  if (rows.length === 0) return ""

  return `### Delegation Trigger Table

| Protocol Type | Delegate To | Trigger |
|--------------|-------------|---------|
${rows.join("\n")}`
}

// ---------------------------------------------------------------------------
// Master builder: compose all dynamic sections
// ---------------------------------------------------------------------------

export function buildDynamicVigiloSections(
  auditors: AvailableAuditor[],
  skills: AvailableSkill[]
): string {
  const sections = [
    buildAuditorSelectionGuide(auditors),
    buildSkillEvaluationGuide(skills),
  ].filter(Boolean)

  return sections.join("\n\n")
}

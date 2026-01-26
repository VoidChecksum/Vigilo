import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { promises as fs } from "node:fs"
import type { BuiltinSkill } from "./types"
import { loadBuiltinSkillsFromDir } from "../opencode-skill-loader/loader"
import type { LoadedSkill } from "../opencode-skill-loader/types"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface CreateBuiltinSkillsOptions {
  disabledSkills?: string[]
}

function loadedSkillToBuiltinSkill(loaded: LoadedSkill): BuiltinSkill {
  return {
    name: loaded.name,
    description: loaded.definition.description || "",
    template: loaded.definition.template || "",
    license: loaded.license,
    compatibility: loaded.compatibility,
    metadata: loaded.metadata as Record<string, unknown> | undefined,
    allowedTools: loaded.allowedTools,
    agent: loaded.definition.agent,
    model: loaded.definition.model,
    subtask: loaded.definition.subtask,
    argumentHint: loaded.definition.argumentHint,
    mcpConfig: loaded.mcpConfig,
  }
}

async function loadSkillsRecursively(dir: string): Promise<LoadedSkill[]> {
  const allSkills: LoadedSkill[] = []
  
  const directSkills = await loadBuiltinSkillsFromDir(dir)
  allSkills.push(...directSkills)
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const subDir = join(dir, entry.name)
        try {
          await fs.access(join(subDir, "SKILL.md"))
        } catch {
          const nestedSkills = await loadSkillsRecursively(subDir)
          allSkills.push(...nestedSkills)
        }
      }
    }
  } catch {
  }
  
  return allSkills
}

export async function createBuiltinSkillsAsync(options?: CreateBuiltinSkillsOptions): Promise<BuiltinSkill[]> {
  const disabled = new Set(options?.disabledSkills ?? [])
  
  const loadedSkills = await loadSkillsRecursively(__dirname)
  const builtinSkills = loadedSkills.map(loadedSkillToBuiltinSkill)
  
  return builtinSkills.filter(skill => !disabled.has(skill.name))
}

let cachedSkills: BuiltinSkill[] | null = null

export function createBuiltinSkills(options?: CreateBuiltinSkillsOptions): BuiltinSkill[] {
  if (cachedSkills) {
    const disabled = new Set(options?.disabledSkills ?? [])
    return cachedSkills.filter(skill => !disabled.has(skill.name))
  }
  return []
}

export async function initBuiltinSkills(options?: CreateBuiltinSkillsOptions): Promise<BuiltinSkill[]> {
  cachedSkills = await createBuiltinSkillsAsync(options)
  return cachedSkills
}

export function getBuiltinSkills(): BuiltinSkill[] {
  return cachedSkills ?? []
}

export function getBuiltinSkill(name: string): BuiltinSkill | undefined {
  return getBuiltinSkills().find(s => s.name === name)
}

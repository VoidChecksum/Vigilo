import { initBuiltinSkills, getBuiltinSkills } from "../builtin-skills/skills"
import { discoverSkills } from "./loader"
import type { LoadedSkill } from "./types"
import { parseFrontmatter } from "../../shared/frontmatter"
import { readFileSync } from "node:fs"

export interface SkillResolutionOptions {
	gitMasterConfig?: {
		commit_footer?: boolean
		include_co_authored_by?: boolean
	}
}

let cachedSkills: LoadedSkill[] | null = null

function clearSkillCache(): void {
	cachedSkills = null
}

async function getAllSkills(): Promise<LoadedSkill[]> {
	if (cachedSkills) return cachedSkills

	const [discoveredSkills, builtinSkillDefs] = await Promise.all([
		discoverSkills({ includeClaudeCodePaths: true }),
		initBuiltinSkills(),
	])

	const builtinSkillsAsLoaded: LoadedSkill[] = builtinSkillDefs.map((skill) => ({
		name: skill.name,
		definition: {
			name: skill.name,
			description: skill.description,
			template: skill.template,
			model: skill.model,
			agent: skill.agent,
			subtask: skill.subtask,
		},
		scope: "builtin" as const,
		license: skill.license,
		compatibility: skill.compatibility,
		metadata: skill.metadata as Record<string, string> | undefined,
		allowedTools: skill.allowedTools,
		mcpConfig: skill.mcpConfig,
	}))

	const discoveredNames = new Set(discoveredSkills.map((s) => s.name))
	const uniqueBuiltins = builtinSkillsAsLoaded.filter((s) => !discoveredNames.has(s.name))

	cachedSkills = [...discoveredSkills, ...uniqueBuiltins]
	return cachedSkills
}

async function extractSkillTemplate(skill: LoadedSkill): Promise<string> {
	if (skill.path) {
		const content = readFileSync(skill.path, "utf-8")
		const { body } = parseFrontmatter(content)
		return body.trim()
	}
	return skill.definition.template || ""
}

export { clearSkillCache, getAllSkills, extractSkillTemplate }

export function injectGitMasterConfig(template: string, config?: SkillResolutionOptions["gitMasterConfig"]): string {
	const commitFooter = config?.commit_footer ?? false
	const includeCoAuthoredBy = config?.include_co_authored_by ?? false

	if (!commitFooter && !includeCoAuthoredBy) {
		return template
	}

	const sections: string[] = []

	sections.push(`### Commit Footer & Co-Author`)
	sections.push(``)

	if (commitFooter) {
		sections.push(`1. **Footer in commit body:**`)
		sections.push("```")
		sections.push(`Audited with Vigilo`)
		sections.push("```")
		sections.push(``)
	}

	if (includeCoAuthoredBy) {
		sections.push(`${commitFooter ? "2" : "1"}. **Co-authored-by trailer:**`)
		sections.push("```")
		sections.push(`Co-authored-by: Vigilo <vigilo@audit.ai>`)
		sections.push("```")
		sections.push(``)
	}

	return template + "\n\n" + sections.join("\n")
}

export function resolveSkillContent(skillName: string, options?: SkillResolutionOptions): string | null {
	const skills = getBuiltinSkills()
	const skill = skills.find((s) => s.name === skillName)
	if (!skill) return null

	if (skillName === "git-master") {
		return injectGitMasterConfig(skill.template, options?.gitMasterConfig)
	}

	return skill.template
}

export function resolveMultipleSkills(skillNames: string[], options?: SkillResolutionOptions): {
	resolved: Map<string, string>
	notFound: string[]
} {
	const skills = getBuiltinSkills()
	const skillMap = new Map(skills.map((s) => [s.name, s.template]))

	const resolved = new Map<string, string>()
	const notFound: string[] = []

	for (const name of skillNames) {
		const template = skillMap.get(name)
		if (template) {
			if (name === "git-master") {
				resolved.set(name, injectGitMasterConfig(template, options?.gitMasterConfig))
			} else {
				resolved.set(name, template)
			}
		} else {
			notFound.push(name)
		}
	}

	return { resolved, notFound }
}

export async function resolveSkillContentAsync(
	skillName: string,
	options?: SkillResolutionOptions
): Promise<string | null> {
	const allSkills = await getAllSkills()
	const skill = allSkills.find((s) => s.name === skillName)
	if (!skill) return null

	const template = await extractSkillTemplate(skill)

	if (skillName === "git-master") {
		return injectGitMasterConfig(template, options?.gitMasterConfig)
	}

	return template
}

export async function resolveMultipleSkillsAsync(
	skillNames: string[],
	options?: SkillResolutionOptions
): Promise<{
	resolved: Map<string, string>
	notFound: string[]
}> {
	const allSkills = await getAllSkills()
	const skillMap = new Map<string, LoadedSkill>()
	for (const skill of allSkills) {
		skillMap.set(skill.name, skill)
	}

	const resolved = new Map<string, string>()
	const notFound: string[] = []

	for (const name of skillNames) {
		const skill = skillMap.get(name)
		if (skill) {
			const template = await extractSkillTemplate(skill)
			if (name === "git-master") {
				resolved.set(name, injectGitMasterConfig(template, options?.gitMasterConfig))
			} else {
				resolved.set(name, template)
			}
		} else {
			notFound.push(name)
		}
	}

	return { resolved, notFound }
}

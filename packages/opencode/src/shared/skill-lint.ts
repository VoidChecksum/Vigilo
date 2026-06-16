import { parseFrontmatter } from "./frontmatter"

export interface SkillEntry {
  /** Path used for reporting (relative is friendliest). */
  path: string
  content: string
}

export interface SkillIssue {
  path: string
  message: string
}

export interface SkillLintResult {
  ok: boolean
  issues: SkillIssue[]
  /** Count of skills checked. */
  count: number
}

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Lint a single SKILL.md's frontmatter. Returns the issues found (empty = clean). */
export function lintSkill(entry: SkillEntry): SkillIssue[] {
  const issues: SkillIssue[] = []
  const fm = parseFrontmatter<{ name?: unknown; description?: unknown }>(entry.content)

  if (!fm.hadFrontmatter) {
    return [{ path: entry.path, message: "missing YAML frontmatter" }]
  }
  if (fm.parseError) {
    return [{ path: entry.path, message: "invalid YAML frontmatter" }]
  }

  const name = fm.data.name
  if (typeof name !== "string" || name.trim() === "") {
    issues.push({ path: entry.path, message: "frontmatter missing required `name`" })
  } else if (!KEBAB.test(name.trim())) {
    issues.push({ path: entry.path, message: `name "${name}" is not kebab-case` })
  }

  const description = fm.data.description
  if (typeof description !== "string" || description.trim() === "") {
    issues.push({ path: entry.path, message: "frontmatter missing required `description`" })
  }

  return issues
}

/** Lint a set of skills: per-file frontmatter checks + duplicate-name detection. */
export function lintSkills(entries: SkillEntry[]): SkillLintResult {
  const issues: SkillIssue[] = []
  const nameToPaths = new Map<string, string[]>()

  for (const entry of entries) {
    issues.push(...lintSkill(entry))
    const fm = parseFrontmatter<{ name?: unknown }>(entry.content)
    const name = typeof fm.data.name === "string" ? fm.data.name.trim() : null
    if (name) nameToPaths.set(name, [...(nameToPaths.get(name) ?? []), entry.path])
  }

  for (const [name, paths] of nameToPaths) {
    if (paths.length > 1) {
      issues.push({ path: paths.join(", "), message: `duplicate skill name "${name}"` })
    }
  }

  return { ok: issues.length === 0, issues, count: entries.length }
}

#!/usr/bin/env bun
/**
 * Lint Vigilo's SKILL.md frontmatter across both skill trees. Each tree is linted
 * independently — the same logical skill (e.g. `reentrancy`) legitimately appears in
 * both the OpenCode and Claude Code distributions, so cross-tree name collisions are
 * expected and not flagged. Exits non-zero on any issue.
 *
 *   bun run script/lint-skills.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { lintSkills, type SkillEntry } from "../src/shared/skill-lint"

const REPO_ROOT = join(import.meta.dir, "..", "..", "..")
const TREES = [
  join(REPO_ROOT, "packages", "opencode", "skills"),
  join(REPO_ROOT, "packages", "claude", "skills"),
]

function findSkillFiles(dir: string): string[] {
  const out: string[] = []
  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...findSkillFiles(full))
    else if (name === "SKILL.md") out.push(full)
  }
  return out
}

let totalIssues = 0
let totalSkills = 0

for (const tree of TREES) {
  const files = findSkillFiles(tree)
  if (files.length === 0) continue
  const entries: SkillEntry[] = files.map((f) => ({
    path: relative(REPO_ROOT, f),
    content: readFileSync(f, "utf-8"),
  }))
  const result = lintSkills(entries)
  totalSkills += result.count
  if (!result.ok) {
    for (const issue of result.issues) {
      console.error(`✗ ${issue.path}: ${issue.message}`)
      totalIssues++
    }
  }
}

if (totalIssues > 0) {
  console.error(`\nskill-lint: ${totalIssues} issue(s) across ${totalSkills} skills.`)
  process.exit(1)
}
console.log(`skill-lint: ${totalSkills} skills OK.`)

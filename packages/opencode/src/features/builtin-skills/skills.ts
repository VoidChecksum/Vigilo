import type { BuiltinSkill } from "./types"

/**
 * Builtin skills are now installed externally via postinstall.mjs
 * to ~/.config/opencode/skills/ and discovered at runtime.
 * 
 * This file is kept minimal to reduce bundle size.
 * Inline skills backup: .backup/skills.ts.inline-backup
 * 
 * Skills are loaded via discoverSkills() in skill-content.ts
 */

// No inline skills - all skills are discovered from external files
export const builtinSkills: BuiltinSkill[] = []

export function getBuiltinSkills(): BuiltinSkill[] {
  return builtinSkills
}

export function getBuiltinSkill(name: string): BuiltinSkill | undefined {
  return builtinSkills.find((s) => s.name === name)
}

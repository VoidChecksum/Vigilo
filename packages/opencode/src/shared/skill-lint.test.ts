import { describe, test, expect } from "bun:test"
import { lintSkill, lintSkills } from "./skill-lint"

const good = `---
name: reentrancy
description: Detects reentrancy.
---
body`

describe("lintSkill", () => {
  test("#given valid frontmatter #then no issues", () => {
    expect(lintSkill({ path: "a", content: good })).toHaveLength(0)
  })

  test("#given no frontmatter #then flags it", () => {
    expect(lintSkill({ path: "a", content: "# just markdown" })[0].message).toContain("missing YAML frontmatter")
  })

  test("#given missing name #then flags required name", () => {
    const c = `---\ndescription: x\n---\nbody`
    expect(lintSkill({ path: "a", content: c }).some((i) => i.message.includes("`name`"))).toBe(true)
  })

  test("#given non-kebab name #then flags it", () => {
    const c = `---\nname: Reentrancy_Auditor\ndescription: x\n---\nbody`
    expect(lintSkill({ path: "a", content: c }).some((i) => i.message.includes("kebab-case"))).toBe(true)
  })

  test("#given missing description #then flags required description", () => {
    const c = `---\nname: reentrancy\n---\nbody`
    expect(lintSkill({ path: "a", content: c }).some((i) => i.message.includes("`description`"))).toBe(true)
  })
})

describe("lintSkills", () => {
  test("#given a clean set #then ok", () => {
    const r = lintSkills([{ path: "a", content: good }, { path: "b", content: `---\nname: oracle\ndescription: y\n---\n` }])
    expect(r.ok).toBe(true)
    expect(r.count).toBe(2)
  })

  test("#given duplicate names #then flags the duplicate", () => {
    const r = lintSkills([{ path: "a", content: good }, { path: "b", content: good }])
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.message.includes("duplicate skill name"))).toBe(true)
  })
})

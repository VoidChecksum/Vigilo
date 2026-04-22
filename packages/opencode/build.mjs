#!/usr/bin/env bun
// Use Bun.build() API directly — `bun build` CLI collides with package.json `build` script on bun >=1.3.
import { $ } from "bun"

const shared = {
  target: "bun",
  format: "esm",
  external: ["@ast-grep/napi"],
}

let r = await Bun.build({ ...shared, entrypoints: ["src/index.ts"], outdir: "dist" })
if (!r.success) { console.error(r.logs); process.exit(1) }

await $`npx tsc --emitDeclarationOnly`

r = await Bun.build({ ...shared, entrypoints: ["src/cli/index.ts"], outdir: "dist/cli" })
if (!r.success) { console.error(r.logs); process.exit(1) }

console.log("build ok")

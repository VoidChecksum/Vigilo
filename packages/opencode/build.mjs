import * as esbuild from "esbuild"

await esbuild.build({
  entryPoints: ["src/index.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "esnext",
  external: ["@opencode-ai/plugin", "@opencode-ai/sdk", "@ast-grep/napi", "bun", "jsonc-parser"],
  sourcemap: true,
})

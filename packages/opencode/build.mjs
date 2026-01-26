#!/usr/bin/env bun
import { $ } from "bun"

await $`bun build src/index.ts --outdir dist --target bun --format esm --external @ast-grep/napi`
await $`tsc --emitDeclarationOnly`
await $`bun build src/cli/index.ts --outdir dist/cli --target bun --format esm --external @ast-grep/napi`

# Release Process

Vigilo ships as an npm package (`vigilo`) backed by seven platform-specific binary packages
(`vigilo-<platform>`), plus a Claude Code plugin. Releases are driven by GitHub Actions —
nothing is published from a laptop.

## Versioning
- [Semantic Versioning](https://semver.org). The main package version is the source of truth;
  the platform packages and plugin manifest track it.
- The CI **consistency** job asserts every published `package.json` is MIT and the root
  marketplace manifest resolves — keep these aligned before tagging.

## Steps

1. **Land all changes on `main`** with green CI (typecheck, tests + coverage gate, semgrep,
   CodeQL, consistency). Update `CHANGELOG.md` (move `[Unreleased]` items under the new version).

2. **Publish the platform binaries first** — run the **`publish-platform`** workflow
   (`workflow_dispatch`). It builds each of the 7 targets (`darwin-arm64`, `darwin-x64`,
   `linux-x64`, `linux-arm64`, `linux-x64-musl`, `linux-arm64-musl`, `windows-x64`) and
   `npm publish --access public`es each `vigilo-<platform>` package. The main package's
   `optionalDependencies` resolve to these, so they must exist first.

3. **Publish the main package** — run the **`publish`** workflow (`workflow_dispatch`) with either
   a `bump` (patch/minor/major, computed from the npm registry's current `latest`) or an explicit
   `version`. It sets the version, builds, and publishes `vigilo`.

4. **Verify**: `bunx vigilo@latest doctor` on a clean machine; confirm the Claude Code plugin
   installs via `/plugin marketplace add PurpleAILAB/Vigilo` → `/plugin install vigilo@vigilo`.

## Notes / future hardening
- Prefer publishing platform packages and the wrapper in the same release window so users never
  see a wrapper referencing a not-yet-published binary version.
- npm provenance/SBOM/signing for the platform binaries is tracked as future work (see
  `docs/engineering/decepticon-gap-roadmap.md`, W2-10).

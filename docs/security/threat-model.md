# Vigilo Threat Model

Vigilo is a security tool that **runs on the auditor's machine and ingests untrusted input** —
the very smart-contract code it is asked to audit, plus the project's docs/READMEs. That makes
Vigilo itself an attack surface. This document states the assets, the adversary, the threats,
and the mitigations that are actually implemented.

## Assets
- The operator's host (filesystem, environment, credentials, network position).
- The operator's LLM provider credentials and any RPC keys.
- The integrity of the audit result (a manipulated audit that hides a real bug is a high-impact failure).

## Adversary
A malicious or compromised **audit target**: the Solidity/Vyper/Cairo source, its build scripts,
its dependencies, and its documentation are all attacker-controlled. The attacker's goals:
1. **Execute code on the host** (via the build/test toolchain).
2. **Exfiltrate secrets** (provider keys, RPC keys, env).
3. **Manipulate the audit** (prompt-injection to suppress or fabricate findings).
4. **Exhaust resources** (a contract/test that never terminates).

## Threats & implemented mitigations

| Threat | Vector | Mitigation (status) |
|--------|--------|---------------------|
| Untrusted code execution | `forge build`/`forge test` compile & run attacker Solidity; Foundry `ffi`/RPC can reach the host/network | **Sandboxed runner** (`shared/exec/runner.ts`): pinned `cwd`, no shell (argv arrays, no injection), wall-clock timeout (SIGTERM→SIGKILL), output cap. ✅ |
| Secret exfiltration | a test/`ffi` reads `process.env` (API keys, cloud creds) | **Scrubbed environment**: the runner exposes only `PATH`/`HOME`/locale + an explicit `FOUNDRY_*`/`SOLC_*` allowlist; unrelated secrets are dropped. ✅ |
| Resource exhaustion | infinite loop / unbounded fuzzing / huge output | Hard timeout + per-stream output cap in the runner. ✅ |
| Prompt injection | attacker text in contract comments / NatSpec / README tries to steer the auditor LLM | See [prompt-injection-defense.md](./prompt-injection-defense.md). ⚠️ partial — posture documented; treat as defense-in-depth, not a guarantee. |
| Supply chain (tooling) | a downloaded analysis binary is tampered | ast-grep is fetched over HTTPS from the canonical release host; checksum pinning is tracked as future hardening. ⚠️ partial |
| Result integrity | a single auditor is fooled | Multi-auditor consensus, evidence hierarchy (PoC-validated > theoretical), and the verifier/purifier stages raise the bar for a finding to be reported. ✅ design |

## Out of scope
- A compromised operator host or malicious operator.
- Vulnerabilities in OpenCode / the underlying LLM provider.
- Guaranteeing detection of every vulnerability (no audit tool can).

## Reporting
Security issues in Vigilo itself: see [SECURITY.md](../../SECURITY.md). Do not open public issues.

# Security Policy

**Vigilo — Web3 Smart Contract Security Auditing Agent**

We take the security of Vigilo itself seriously. This document explains which versions are
supported, what to report, how to report it, and what to expect after you do.

---

## Supported Versions

Security fixes are provided for the current minor release line.

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅ |
| < 1.0   | ❌ |

We strongly recommend always running the latest published version (`bunx vigilo@latest`).

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions,
or pull requests.**

Use one of the following private channels instead:

1. **GitHub Security Advisories (preferred)** — open a private report via the
   [Security Advisories](https://github.com/PurpleAILAB/Vigilo/security/advisories/new)
   page of the repository. This keeps the disclosure private and lets us collaborate on a
   fix and CVE if warranted.
2. **Email** — send details to **purpleailab@gmail.com**. Encrypt sensitive details if you
   can; otherwise plain email is acceptable for initial contact.

Please include as much of the following as possible:

- A clear description of the issue and its impact.
- Steps to reproduce (a minimal proof-of-concept is ideal).
- Affected version(s) and environment (OS, Node/Bun version, OpenCode/Claude Code).
- Any suggested remediation.

---

## What to Report

Report vulnerabilities in **Vigilo as a tool**, including:

- **Vulnerabilities in Vigilo's own code** — the OpenCode/Claude Code plugin, the `vigilo`
  CLI, the `vigilo-bench` pipeline, or supporting scripts.
- **Sandbox escapes** — any way for a target contract or its build/test toolchain to break
  out of Vigilo's sandboxed command runner (pinned cwd, timeout, output cap, scrubbed env,
  no shell) and affect the host.
- **Credential handling flaws** — leakage, logging, or insecure storage of LLM provider keys,
  RPC keys, or other secrets (including any that reach a tool's environment).
- **Prompt-injection bypasses** — a way for attacker-controlled target text (contract comments,
  NatSpec, READMEs) to manipulate the audit (suppress/fabricate findings). See the design notes
  below.
- **Dependency vulnerabilities** — exploitable issues in Vigilo's dependency tree that
  affect Vigilo users (please indicate the package, version, and exploit path).
- **Supply-chain or release-integrity issues** — problems with published npm packages,
  build provenance, or the release workflow.

---

## Security Design

Vigilo runs on the auditor's machine and ingests untrusted target code/docs, so it is itself
an attack surface. Its design and mitigations are documented in:

- [Threat Model](./docs/security/threat-model.md) — assets, adversary, threats, and the
  implemented mitigations (sandboxed runner, env scrubbing, evidence hierarchy).
- [Prompt-Injection Defense](./docs/security/prompt-injection-defense.md) — how attacker-controlled
  text is kept as data, not instructions.

---

## What NOT to Report Here

This policy covers Vigilo the tool, **not** the artifacts it produces or analyzes:

- **Vulnerabilities in smart contracts that Vigilo audits.** Those are the *output* of the
  tool — report them to the relevant protocol team, audit contest platform
  (Code4rena, Sherlock, Cantina, Immunefi), or bug bounty program, not to us.
- **General security best-practice suggestions** that are not an exploitable flaw (e.g.
  "you should add X hardening"). Open a normal feature request or discussion instead.
- **Findings already documented** in our public `findings/` directory or known issues.

---

## Response Timeline

We aim to respond on the following schedule:

| Stage | Target |
|-------|--------|
| **Acknowledgement** of your report | within **48 hours** |
| **Initial assessment** & severity triage | within **7 days** |
| **Fix or mitigation** released | within **30 days** of confirmation |

Timelines may vary with complexity; we will keep you informed of progress. We practice
coordinated disclosure and will credit reporters who wish to be acknowledged once a fix is
released.

---

## License

Vigilo is distributed under the [MIT License](./LICENSE). Security research,
auditing, and any other use of Vigilo are expressly permitted.

---

Thank you for helping keep Vigilo and its users safe.

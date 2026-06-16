# Models

Vigilo runs **inside [OpenCode](https://opencode.ai)**. It does not ship its own
provider layer, key manager, or model router — model and provider selection is
**OpenCode-native**. You configure providers and credentials through OpenCode's own
config exactly as you would for any other OpenCode agent, and Vigilo adds a small,
optional **per-auditor override** mechanism on top via `vigilo.json`.

There is no tier system, no fallback chain, and no bundled proxy. Each agent simply
has a `model`, and you can change it.

---

## How a Model Gets Picked

Each Vigilo agent is created with a single `model` string (provider-prefixed, e.g.
`anthropic/claude-sonnet-4-5`). Resolution is straightforward, highest precedence first:

1. **Per-auditor override** in `vigilo.json` (the `model` field for that auditor).
2. **The agent's built-in default model.** Most specialist auditors fall back to a
   shared default (`DEFAULT_MODEL`, currently `anthropic/claude-sonnet-4-5`, defined in
   `packages/opencode/src/agents/auditors/constants.ts`). A few agents pin their own
   default — for example the `graph-builder` agent defaults to
   `anthropic/claude-sonnet-4-5` as well.

Provider credentials (API keys, base URLs, custom/OpenAI-compatible providers) are
resolved entirely by **OpenCode**, not by Vigilo. See the
[OpenCode model/provider docs](https://opencode.ai/docs/models/) for how to add keys
and providers. Any provider/model OpenCode supports can be used as an auditor's
`model` value.

---

## Quick Start

Configure your provider in OpenCode (for example, set `ANTHROPIC_API_KEY` or add the
provider in your OpenCode config), then run an audit:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
opencode
/audit
```

With no `vigilo.json` overrides, every agent uses its default model and the audit runs
end to end.

---

## Per-Auditor Overrides (`vigilo.json`)

To change the model (or other settings) for a specific auditor, add an `auditors`
section to `vigilo.json`. Overrides are validated by `AuditorOverrideConfigSchema` in
[`packages/opencode/src/config/schema.ts`](../packages/opencode/src/config/schema.ts).

```json
{
  "auditors": {
    "vigilo":             { "model": "anthropic/claude-opus-4-5" },
    "explorator":         { "model": "anthropic/claude-sonnet-4-5" },
    "speculator":         { "model": "anthropic/claude-sonnet-4-5" },
    "reentrancy-auditor": { "model": "anthropic/claude-sonnet-4-5", "temperature": 0.1 }
  }
}
```

Any auditor not listed keeps its built-in default model. The auditor keys are the
built-in auditor names (`vigilo`, `explorator`, `speculator`, `reentrancy-auditor`,
`oracle-auditor`, `access-control-auditor`, `flashloan-auditor`, `logic-auditor`,
`defi-auditor`, `cross-chain-auditor`, `token-auditor`).

### Override fields

Every field below is optional; set only what you want to change for that auditor.

| Field | Type | Purpose |
|-------|------|---------|
| `model` | string | Provider-prefixed model id (e.g. `anthropic/claude-opus-4-5`). |
| `variant` | string | Model variant/alias, when the provider exposes one. |
| `temperature` | number (0–2) | Sampling temperature. |
| `top_p` | number (0–1) | Nucleus sampling cutoff. |
| `prompt` | string | Replace the auditor's system prompt entirely. |
| `prompt_append` | string | Append extra instructions to the auditor's prompt. |
| `tools` | record<string, boolean> | Enable/disable individual tools for this auditor. |
| `disable` | boolean | Turn the auditor off entirely. |
| `description` | string | Override the auditor's description. |
| `mode` | `subagent` \| `primary` \| `all` | How the auditor is exposed in OpenCode. |
| `color` | string (`#RRGGBB`) | UI color for the auditor. |
| `permission` | object | Per-tool permissions (`edit`, `bash`, `webfetch`, `doom_loop`, `external_directory`), each `ask` \| `allow` \| `deny`. |

> **Note:** `vigilo.json` controls per-auditor *overrides*. It does not set provider
> credentials — those live in your OpenCode configuration.

### Disabling auditors and other Vigilo settings

`vigilo.json` also accepts top-level lists for turning built-ins off
(`disabled_auditors`, `disabled_skills`, `disabled_hooks`, `disabled_commands`) and
other Vigilo-specific options. See
[`packages/opencode/src/config/schema.ts`](../packages/opencode/src/config/schema.ts)
for the full schema.

---

## Choosing Models for an Audit

There are no fixed tiers, but the agents do different kinds of work, which is a useful
guide when assigning models:

- **Orchestration** (`vigilo`) and **specialist auditors** do the heavy reasoning —
  hypothesis construction, attack-path analysis, PoC writing. These benefit most from a
  strong model.
- **Recon** (`explorator`, `speculator`) does high-volume reading and summarization, and
  can run on a lighter/cheaper model if you want to control cost.

This is purely a configuration choice you make per auditor in `vigilo.json` — Vigilo
does not switch models automatically and does not fall back between providers.

---

## See Also

- [Installation Guide](./installation.md) — set up OpenCode and the plugin.
- [Architecture](./architecture.md) — how agents and the execution runner fit together.
- [Agents](./agents.md) — what each auditor does.
- [OpenCode model docs](https://opencode.ai/docs/models/) — providers and credentials.

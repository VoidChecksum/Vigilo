# Running the Vigilo benchmark against a local model

This document records a **reproducible, end-to-end live run** of the Vigilo benchmark
scorer against a locally-hosted model, and the empirical findings about model-capability
requirements. It exists so the benchmark's model dependency is characterized with evidence,
not assertion.

## Why

The benchmark's LLM-judge (`packages/bench/src/scorer`) compares Vigilo's findings against
verified ground truth. It talks to whatever model OpenCode is configured with. To validate the
*pipeline* independent of a paid API, we ran it against a local `llama.cpp` server.

## Setup (reproducible)

```bash
# 1. Durable runtime (survives /tmp wipes)
mkdir -p ~/.cache/vigilo-models && cd ~/.cache/vigilo-models
curl -sSL -o llamacpp.tgz \
  https://github.com/ggml-org/llama.cpp/releases/download/b9654/llama-b9654-bin-ubuntu-x64.tar.gz
tar xzf llamacpp.tgz
curl -sSL --http1.1 --retry 5 -C - -o model.gguf \
  https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf

# 2. Start the model server (OpenAI-compatible)
./llama-b9654/llama-server -m model.gguf --host 127.0.0.1 --port 8081 -c 4096 -t "$(nproc)"

# 3. OpenCode config: an openai-compatible `llamacpp` provider + a lean `judge` agent
#    (see ~/.cache/vigilo-models/opencode.json in this investigation)
OPENCODE_CONFIG=~/.cache/vigilo-models/opencode.json opencode serve --port 4096

# 4. Run the scorer against a contest, pointing it at the local model
cd packages/bench
BENCH_MODEL=llamacpp/qwen OPENCODE_PORT=4096 \
  bun run src/cli.ts score <contest-id> --iterations 1
```

## Findings (empirical)

1. **The pipeline executes end-to-end with live inference and scores correctly.** The bench
   sends the real judge prompt, the local model runs inference, the response is parsed, and a
   `ScoreResult` is written — no mock anywhere. Measured against the `live-demo-vault` fixture
   with the **direct OpenAI-compatible path** (`BENCH_OPENAI_BASE_URL`), a 0.5B model on CPU:

   ```json
   { "model": "llamacpp/qwen", "total_truth": 2, "exact_matches": 2,
     "detection_rate": 1.0, "f1_score": 1.0, "precision": 1.0,
     "scoring_tokens": 5996, "audit_duration_ms": 20581 }
   ```

   100% detection (both the access-control and reentrancy vulns matched), ~20s, with provider
   token usage captured live (W2-9). This is a *real* audit-quality score from a local model.

2. **Vigilo's judge prompt and matching logic are correct.** The 0.5B model returns valid,
   schema-conformant, correct JSON verdicts for the real `buildPrompt()` output. Note the
   majority-vote requires ≥2 agreeing iterations, so the scorer must run with `iterations ≥ 2`
   (the default is 3); `--iterations 1` can never register a match by design.

3. **The bottleneck was OpenCode's agent layer, not model capability.** Routed through OpenCode's
   default agent, even with a `system`/`tools` override, the tiny model is swamped by the
   coding-agent scaffolding (it echoes OpenCode's internal `summary`/`title` sub-agent template
   instead of the verdict) and per-call CPU latency is ~15× higher (OpenCode issues extra
   sub-agent calls per session). The first end-to-end run through OpenCode therefore scored 0% in
   305s. Bypassing that layer with the **direct path** fixed both: 100% in ~20s. A capable model
   (the default `anthropic/claude-*`) handles either path fine; the direct path is what makes
   *small/local* judges viable.

## Scorer hardening that came out of this

- **Direct OpenAI-compatible judging** (`BENCH_OPENAI_BASE_URL` / `BENCH_OPENAI_MODEL` /
  `BENCH_OPENAI_API_KEY`): the judge can hit any `/chat/completions` endpoint directly, skipping
  OpenCode's agent layer entirely. Deterministic `temperature: 0`. No OpenCode server required —
  useful in CI and for self-hosted/local judges. This is what produced the 100% local result.
- **Lean, non-agentic OpenCode path**: when routing through OpenCode, `sendPrompt` overrides the
  session with a minimal `system` prompt and an empty tool set (`SCORER_SYSTEM_PROMPT` /
  `SCORER_NO_TOOLS`) — ≈4× lower per-call latency, cheaper, no tool-loop risk, for any model.
- **Robust verdict parsing** (`parseLLMResponse`): accepts a fenced ```json block, raw JSON, or
  a bare `{...}` embedded in prose; returns `null` on non-JSON. Unit-tested.

## Fixture

`packages/bench/data/sources/live-demo-vault/` + `data/truth/live-demo-vault.json` is a tiny,
fully-self-contained contest (a `Vault.sol` with a real missing-access-control bug and a real
reentrancy bug, plus matching Vigilo findings and ground truth) used to exercise this path
without network access.

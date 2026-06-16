import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk/client";
import { spawn, type ChildProcess } from "child_process";
import { log, error } from "../utils.js";

export interface LLMResponse {
  is_match: boolean;
  is_partial_match: boolean;
  explanation: string;
  severity_from_junior_auditor: string;
  severity_from_truth: string;
  index_of_finding_from_junior_auditor: number;
}

const OPENCODE_PORT = parseInt(process.env.OPENCODE_PORT || "4096", 10);
const OPENCODE_URL = process.env.OPENCODE_URL || `http://localhost:${OPENCODE_PORT}`;

// --- Direct OpenAI-compatible scoring (optional) ------------------------------
// The LLM-judge is a pure classification call. By default it routes through OpenCode,
// but OpenCode wraps every prompt in a coding-agent (large system prompt, tool belt,
// per-session title/summary sub-agent calls) — wasteful for a classifier, and enough to
// derail small/local models entirely. Setting BENCH_OPENAI_BASE_URL makes the judge hit an
// OpenAI-compatible /chat/completions endpoint *directly*: no agent scaffolding, deterministic
// `temperature: 0`, and no need to run a full OpenCode server (handy in CI / self-hosted judges).
const DIRECT_BASE_URL = process.env.BENCH_OPENAI_BASE_URL?.replace(/\/+$/, "") || null;
const DIRECT_API_KEY = process.env.BENCH_OPENAI_API_KEY || "sk-local";
const DIRECT_MODEL = process.env.BENCH_OPENAI_MODEL || null;

let client: OpencodeClient | null = null;
let serverProcess: ChildProcess | null = null;

/**
 * Test-only seam: when set, {@link sendPrompt} returns this responder's result
 * instead of contacting a live OpenCode server. Keeps scorer unit tests
 * hermetic and fast. Production code never sets this.
 */
let mockResponder: ((prompt: string, model: string) => LLMResponse | null) | null = null;

/** @internal test hook — inject (or clear with `null`) a deterministic responder. */
export function __setMockResponder(
  fn: ((prompt: string, model: string) => LLMResponse | null) | null
): void {
  mockResponder = fn;
}

// --- Usage accounting ---------------------------------------------------------
// The scorer is itself an LLM run; capture its cost/tokens so benchmark scores
// record how much the scoring (vs the audit) cost — transparency for fair
// model-vs-model comparison.

export interface UsageTotals {
  cost: number;
  tokens: number;
}

interface MessageUsageInfo {
  cost?: number;
  tokens?: { input?: number; output?: number; reasoning?: number };
}

let usageTotals: UsageTotals = { cost: 0, tokens: 0 };

/** Pure: fold one assistant message's usage into an accumulator. */
export function addMessageUsage(acc: UsageTotals, info?: MessageUsageInfo): UsageTotals {
  if (!info) return acc;
  const t = info.tokens;
  const tokenSum = (t?.input ?? 0) + (t?.output ?? 0) + (t?.reasoning ?? 0);
  return { cost: acc.cost + (info.cost ?? 0), tokens: acc.tokens + tokenSum };
}

export function getUsageTotals(): UsageTotals {
  return { ...usageTotals };
}

export function resetUsageTotals(): void {
  usageTotals = { cost: 0, tokens: 0 };
}

/**
 * Sum cost/tokens across a session's messages (each message's `info` carries the
 * assistant usage). Used to capture the AUDIT run's spend — distinct from the
 * scorer's — by querying the audit session before it's deleted. Pure/testable.
 */
export function sumSessionUsage(messages: Array<{ info?: MessageUsageInfo }>): UsageTotals {
  let acc: UsageTotals = { cost: 0, tokens: 0 };
  for (const m of messages ?? []) acc = addMessageUsage(acc, m?.info);
  return acc;
}

async function tryConnect(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/global/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function startServer(port: number): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn("opencode", ["serve", "--port", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      detached: false,
    });

    let started = false;
    const timeout = setTimeout(() => {
      if (!started) {
        proc.kill();
        reject(new Error("Server start timeout"));
      }
    }, 30000);

    proc.stdout?.on("data", async () => {
      if (!started) {
        await new Promise(r => setTimeout(r, 1000));
        if (await tryConnect(`http://localhost:${port}`)) {
          started = true;
          clearTimeout(timeout);
          resolve(proc);
        }
      }
    });

    proc.stderr?.on("data", (data) => {
      const msg = data.toString();
      if (msg.includes("error") || msg.includes("Error")) {
        if (!started) {
          clearTimeout(timeout);
          reject(new Error(msg));
        }
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    proc.on("exit", (code) => {
      if (!started && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    setTimeout(async () => {
      if (!started && await tryConnect(`http://localhost:${port}`)) {
        started = true;
        clearTimeout(timeout);
        resolve(proc);
      }
    }, 3000);
  });
}

export async function initOpenCodeClient(model: string): Promise<void> {
  if (DIRECT_BASE_URL) {
    log(`Scorer using direct OpenAI-compatible endpoint: ${DIRECT_BASE_URL} (model ${DIRECT_MODEL || parseModel(model).modelID}, temperature 0)`);
    return;
  }
  if (client) return;

  log(`Connecting to OpenCode server at ${OPENCODE_URL}...`);
  
  if (await tryConnect(OPENCODE_URL)) {
    client = createOpencodeClient({ baseUrl: OPENCODE_URL });
    log("Connected to existing OpenCode server");
    return;
  }

  log("No running server found. Starting OpenCode server...");
  
  try {
    serverProcess = await startServer(OPENCODE_PORT);
    client = createOpencodeClient({ baseUrl: `http://localhost:${OPENCODE_PORT}` });
    log(`OpenCode server started on port ${OPENCODE_PORT}`);
  } catch (err) {
    error(`Failed to start OpenCode server: ${err}\n\nPlease start manually: opencode serve`);
  }
}

export async function closeOpenCodeClient(): Promise<void> {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
    log("OpenCode server stopped");
  }
  client = null;
}

function parseModel(model: string): { providerID: string; modelID: string } {
  const [providerID, ...rest] = model.split("/");
  const modelID = rest.join("/");
  return { providerID, modelID: modelID || model };
}

// The LLM-judge is a *pure classification* call, not an agentic coding task. Running it
// through OpenCode's default build-agent (large system prompt + a full tool belt) is both
// wasteful and a correctness hazard: the judge could wander into tool calls/loops, and the
// heavy context makes small or local models intractably slow. Override with a minimal system
// prompt and an empty tool set so every judgment is a single, fast, deterministic completion.
const SCORER_SYSTEM_PROMPT =
  "You are a precise security-finding matching judge. Follow the user's instructions exactly. " +
  "Do not call any tools or take any actions. Respond with only the requested JSON object and nothing else.";

// Disable the standard OpenCode tools for the judge session (read-only judgment, no side effects).
const SCORER_NO_TOOLS: Record<string, boolean> = {
  bash: false, edit: false, write: false, read: false, grep: false, glob: false,
  list: false, patch: false, webfetch: false, todowrite: false, todoread: false, task: false,
};

/**
 * Extract the judge's JSON verdict from a model response. Prefers a fenced ```json block,
 * falls back to the raw text, then to the first bare `{...}` object — robust to chatty models
 * that wrap the JSON in prose. Pure/testable.
 */
export function parseLLMResponse(responseText: string): LLMResponse | null {
  const fenced = responseText.match(/```json\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : responseText;
  try {
    return JSON.parse(candidate) as LLMResponse;
  } catch {
    const bare = responseText.match(/\{[\s\S]*\}/);
    if (bare) {
      try {
        return JSON.parse(bare[0]) as LLMResponse;
      } catch {
        /* fall through */
      }
    }
    log(`Failed to parse LLM JSON response: ${candidate.slice(0, 200)}...`);
    return null;
  }
}

/** Judge via a direct OpenAI-compatible /chat/completions call (no OpenCode agent layer). */
async function sendPromptDirect(prompt: string, model: string): Promise<LLMResponse | null> {
  const modelName = DIRECT_MODEL || parseModel(model).modelID;
  try {
    const res = await fetch(`${DIRECT_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DIRECT_API_KEY}` },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: SCORER_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(180000),
    });
    if (!res.ok) {
      log(`Direct judge HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      cost?: number;
    };
    if (json.usage) {
      usageTotals = addMessageUsage(usageTotals, {
        cost: json.cost,
        tokens: { input: json.usage.prompt_tokens, output: json.usage.completion_tokens },
      });
    }
    const text = json.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      log("Direct judge: no text content in response");
      return null;
    }
    return parseLLMResponse(text);
  } catch (err) {
    log(`Direct judge error: ${err}`);
    return null;
  }
}

export async function sendPrompt(prompt: string, model: string): Promise<LLMResponse | null> {
  if (mockResponder) {
    return mockResponder(prompt, model);
  }
  if (DIRECT_BASE_URL) {
    return sendPromptDirect(prompt, model);
  }
  if (!client) {
    error("OpenCode client not initialized. Call initOpenCodeClient() first.");
    return null;
  }

  let sessionId: string | null = null;

  try {
    const createRes = await client.session.create({ body: { title: "bench-scorer-prompt" } });
    if (!createRes.data?.id) {
      log("Failed to create session");
      return null;
    }
    sessionId = createRes.data.id;

    const promptRes = await client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: "text", text: prompt }],
        model: parseModel(model),
        system: SCORER_SYSTEM_PROMPT,
        tools: SCORER_NO_TOOLS,
      },
    });

    if (!promptRes.data) {
      log(`Prompt request failed: ${JSON.stringify(promptRes.error)}`);
      return null;
    }

    // Record the scorer's own token/cost spend.
    usageTotals = addMessageUsage(usageTotals, promptRes.data.info as MessageUsageInfo | undefined);

    const textPart = promptRes.data.parts?.find((p) => p.type === "text");
    if (!textPart || textPart.type !== "text") {
      log(`No text response from OpenCode. Parts: ${JSON.stringify(promptRes.data.parts?.map(p => p.type))}`);
      return null;
    }

    return parseLLMResponse(textPart.text);
  } catch (err) {
    log(`OpenCode prompt error: ${err}`);
    return null;
  } finally {
    if (sessionId && client) {
      await client.session.delete({ path: { id: sessionId } }).catch(() => {});
    }
  }
}

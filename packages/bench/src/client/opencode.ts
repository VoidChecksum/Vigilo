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

let client: OpencodeClient | null = null;
let serverProcess: ChildProcess | null = null;

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

export async function sendPrompt(prompt: string, model: string): Promise<LLMResponse | null> {
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
      },
    });

    if (!promptRes.data) {
      log(`Prompt request failed: ${JSON.stringify(promptRes.error)}`);
      return null;
    }

    const textPart = promptRes.data.parts?.find((p) => p.type === "text");
    if (!textPart || textPart.type !== "text") {
      log(`No text response from OpenCode. Parts: ${JSON.stringify(promptRes.data.parts?.map(p => p.type))}`);
      return null;
    }

    const responseText = textPart.text;
    
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : responseText;

    try {
      return JSON.parse(jsonStr) as LLMResponse;
    } catch {
      log(`Failed to parse LLM JSON response: ${jsonStr.slice(0, 200)}...`);
      return null;
    }
  } catch (err) {
    log(`OpenCode prompt error: ${err}`);
    return null;
  } finally {
    if (sessionId && client) {
      await client.session.delete({ path: { id: sessionId } }).catch(() => {});
    }
  }
}

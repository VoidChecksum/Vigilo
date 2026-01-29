import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk/client";
import { spawn, exec, type ChildProcess } from "child_process";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { platform } from "os";
import { checkout } from "./checkout.js";
import { score } from "./score.js";
import { report } from "./report.js";
import { log, error, sourcePath, truthPath } from "../utils.js";

const AUDIT_PORT = 4097;
const AUDIT_TIMEOUT_60_MINUTES_MS = 60 * 60 * 1000;
const POLL_INTERVAL_5_SECONDS_MS = 5_000;

interface PipelineOptions {
  verbose?: boolean;
  skipAudit?: boolean;
  watch?: boolean;
}

async function tryConnect(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/global/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function startAuditServer(sourceDir: string, port: number): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    log(`Starting OpenCode server in ${sourceDir}...`);
    
    const proc = spawn("opencode", ["serve", "--port", String(port)], {
      cwd: sourceDir,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      detached: false,
    });

    let started = false;
    const timeout = setTimeout(() => {
      if (!started) {
        proc.kill();
        reject(new Error("Server start timeout (30s)"));
      }
    }, 30000);

    const checkStarted = async () => {
      if (!started && await tryConnect(`http://localhost:${port}`)) {
        started = true;
        clearTimeout(timeout);
        resolve(proc);
      }
    };

    proc.stdout?.on("data", async () => {
      await new Promise(r => setTimeout(r, 1000));
      await checkStarted();
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

    // Fallback check
    setTimeout(checkStarted, 5000);
  });
}

function isAuditComplete(sourceDir: string): boolean {
  const auditStatePath = join(sourceDir, ".vigilo", "audit-state.json");
  
  if (!existsSync(auditStatePath)) return false;
  
  try {
    const state = JSON.parse(readFileSync(auditStatePath, "utf-8"));
    return state.current_phase === "complete";
  } catch {
    return false;
  }
}

function hasAnyFindings(sourceDir: string): boolean {
  const findingsDir = join(sourceDir, ".vigilo", "findings");
  
  if (!existsSync(findingsDir)) return false;
  
  try {
    const severities = ["critical", "high", "medium", "low"];
    for (const sev of severities) {
      const sevDir = join(findingsDir, sev);
      if (!existsSync(sevDir)) continue;
      
      const entries = readdirSync(sevDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".md")) {
          return true;
        }
        if (entry.isDirectory()) {
          const auditorDir = join(sevDir, entry.name);
          const auditorFiles = readdirSync(auditorDir).filter(f => f.endsWith(".md"));
          if (auditorFiles.length > 0) return true;
        }
      }
    }
  } catch {
    return false;
  }
  
  return false;
}

async function waitForAuditComplete(sourceDir: string, timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (isAuditComplete(sourceDir)) {
      return true;
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_5_SECONDS_MS));
    process.stdout.write(".");
  }
  
  return false;
}

async function runAudit(sourceDir: string, client: OpencodeClient): Promise<boolean> {
  log("Creating audit session...");
  
  const createRes = await client.session.create({ 
    body: { title: "vigilo-bench-audit" } 
  });
  
  if (!createRes.data?.id) {
    error("Failed to create audit session");
    return false;
  }
  
  const sessionId = createRes.data.id;
  log(`Session created: ${sessionId}`);
  
  try {
    log("Sending /audit command...");
    
    // Send /audit command - this triggers Vigilo's audit workflow
    const promptRes = await client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: "text", text: "/audit" }],
      },
    });
    
    if (!promptRes.data) {
      error(`Audit command failed: ${JSON.stringify(promptRes.error)}`);
      return false;
    }
    
    log("Audit started. Waiting for completion (this may take 10-30 minutes)...");
    
    // Poll for .vigilo/findings to appear
    const completed = await waitForAuditComplete(sourceDir, AUDIT_TIMEOUT_60_MINUTES_MS);
    
    if (!completed) {
      error("Audit timeout - no findings generated within 30 minutes");
      return false;
    }
    
    console.log(); // newline after dots
    log("Audit completed!");
    return true;
    
  } finally {
    // Cleanup session
    await client.session.delete({ path: { id: sessionId } }).catch(() => {});
  }
}

function openTerminalWithOpencode(sourceDir: string): void {
  const os = platform();
  
  if (os === "win32") {
    exec(`start cmd /k "cd /d ${sourceDir} && opencode"`, { shell: "cmd.exe" });
  } else if (os === "darwin") {
    exec(`osascript -e 'tell app "Terminal" to do script "cd ${sourceDir} && opencode"'`);
  } else {
    const terminals = ["gnome-terminal", "konsole", "xfce4-terminal", "xterm"];
    for (const term of terminals) {
      try {
        if (term === "gnome-terminal") {
          exec(`${term} -- bash -c "cd ${sourceDir} && opencode; exec bash"`);
        } else {
          exec(`${term} -e "bash -c 'cd ${sourceDir} && opencode; exec bash'"`);
        }
        break;
      } catch {
        continue;
      }
    }
  }
}

export async function pipeline(contestId: string, options: PipelineOptions = {}): Promise<void> {
  const { verbose = false, skipAudit = false, watch = false } = options;
  
  log(`\n${"=".repeat(60)}`);
  log(`  VIGILO BENCH PIPELINE: ${contestId}`);
  log(`${"=".repeat(60)}\n`);
  
  const sourceDir = sourcePath(contestId);
  const truthFile = truthPath(contestId);
  
  if (!existsSync(sourceDir) || !existsSync(truthFile)) {
    log("[1/4] Checkout source and ground truth...");
    await checkout(contestId);
  } else {
    log("[1/4] Source and truth already exist, skipping checkout");
  }
  
  if (!skipAudit) {
    if (isAuditComplete(sourceDir) || hasAnyFindings(sourceDir)) {
      log("[2/4] Audit already completed, skipping");
    } else if (watch) {
      log("[2/4] Opening OpenCode for audit (watch mode)...");
      openTerminalWithOpencode(sourceDir);
      log("Run /audit in the OpenCode window. Waiting for audit to complete...");
      
      const completed = await waitForAuditComplete(sourceDir, AUDIT_TIMEOUT_60_MINUTES_MS);
      if (!completed) {
        error("Audit timeout - no findings generated within 60 minutes");
        return;
      }
      console.log();
      log("Audit completed!");
    } else {
      log("[2/4] Running Vigilo audit (headless)...");
      
      let serverProcess: ChildProcess | null = null;
      
      try {
        serverProcess = await startAuditServer(sourceDir, AUDIT_PORT);
        log(`OpenCode server running on port ${AUDIT_PORT}`);
        
        const client = createOpencodeClient({ baseUrl: `http://localhost:${AUDIT_PORT}` });
        
        const success = await runAudit(sourceDir, client);
        if (!success) {
          error("Audit failed");
          return;
        }
      } finally {
        if (serverProcess) {
          serverProcess.kill();
          log("OpenCode server stopped");
        }
      }
    }
  } else {
    log("[2/4] Audit skipped (--skip-audit flag)");
    if (!hasAnyFindings(sourceDir)) {
      error("No findings found. Run audit first.");
      return;
    }
  }
  
  log("[3/4] Scoring findings against ground truth...");
  await score(contestId, { verbose: verbose ? true : undefined });
  
  log("[4/4] Generating report...");
  await report({ contest: contestId });
  
  log(`\n${"=".repeat(60)}`);
  log(`  PIPELINE COMPLETE: ${contestId}`);
  log(`${"=".repeat(60)}\n`);
}

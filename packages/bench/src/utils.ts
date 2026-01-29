import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import type { ContestRegistry, ScaBenchDataset, BaselineComparison } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, "..");
export const DATA_DIR = resolve(ROOT, "data");
export const SOURCES_DIR = resolve(DATA_DIR, "sources");
export const TRUTH_DIR = resolve(DATA_DIR, "truth");
export const SCORES_DIR = resolve(DATA_DIR, "scores");
export const REPORTS_DIR = resolve(DATA_DIR, "reports");
export const BASELINES_DIR = resolve(DATA_DIR, "baselines");

const DIRS = [DATA_DIR, SOURCES_DIR, TRUTH_DIR, SCORES_DIR, REPORTS_DIR];

export function ensureDirs(): void {
  for (const dir of DIRS) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

export function registryPath(): string {
  return resolve(DATA_DIR, "contests.json");
}

export function loadRegistry(): ContestRegistry {
  const p = registryPath();
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, "utf-8"));
}

export function saveRegistry(registry: ContestRegistry): void {
  ensureDirs();
  writeFileSync(registryPath(), JSON.stringify(registry, null, 2));
}

export function datasetPath(): string {
  return resolve(DATA_DIR, "dataset.json");
}

export function loadDataset(): ScaBenchDataset {
  const p = datasetPath();
  if (!existsSync(p)) {
    throw new Error(`ScaBench dataset not found at ${p}. Run: git clone https://github.com/scabench-org/scabench && cp scabench/datasets/curated-2025-08-18/curated-2025-08-18.json ${p}`);
  }
  return JSON.parse(readFileSync(p, "utf-8"));
}

export function sourcePath(contestId: string): string {
  return resolve(SOURCES_DIR, contestId);
}

export function truthPath(contestId: string): string {
  return resolve(TRUTH_DIR, `${contestId}.json`);
}

export function scoresPath(contestId: string): string {
  return resolve(SCORES_DIR, contestId);
}

export function shell(cmd: string, cwd?: string): string {
  return execSync(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

export function log(msg: string): void {
  console.log(`[bench] ${msg}`);
}

export function error(msg: string): never {
  console.error(`[bench] ERROR: ${msg}`);
  process.exit(1);
}

export interface ScorerConfig {
  model: string;
  iterations: number;
  batchSize: number;
  verbose: boolean;
}

export function loadScorerConfig(options?: { iterations?: string; batchSize?: string; verbose?: boolean }): ScorerConfig {
  return {
    model: process.env.BENCH_MODEL || "anthropic/claude-opus-4-5",
    iterations: parseInt(options?.iterations || "3", 10),
    batchSize: parseInt(options?.batchSize || "5", 10),
    verbose: options?.verbose ?? false,
  };
}

export interface ScaBenchBaseline {
  project: string;
  timestamp: string;
  files_analyzed: number;
  files_skipped: number;
  total_findings: number;
  findings: Array<{
    title: string;
    description: string;
    vulnerability_type: string;
    severity: string;
    confidence: number;
    location: string;
    file: string;
    id: string;
    reported_by_model: string;
    status: string;
  }>;
}

export function loadBaseline(contestId: string): ScaBenchBaseline | null {
  const baselinePath = resolve(BASELINES_DIR, `baseline_${contestId}.json`);
  if (!existsSync(baselinePath)) {
    return null;
  }
  return JSON.parse(readFileSync(baselinePath, "utf-8"));
}

export function computeBaselineComparison(
  vigiloExact: number,
  vigiloDetectionRate: number,
  truthFindings: Array<{ finding_id: string; title: string; severity: string; description: string }>,
  baseline: ScaBenchBaseline
): BaselineComparison {
  const baselineDetectionRate = 0;
  const baselineExactMatches = 0;
  
  let delta = vigiloDetectionRate - baselineDetectionRate;
  let comparison: "better" | "worse" | "equal" = "equal";
  if (delta > 0.01) comparison = "better";
  else if (delta < -0.01) comparison = "worse";

  return {
    baseline_model: baseline.findings[0]?.reported_by_model || "gpt-5",
    baseline_total_findings: baseline.total_findings,
    baseline_exact_matches: baselineExactMatches,
    baseline_detection_rate: baselineDetectionRate,
    vigilo_vs_baseline: comparison,
    delta_detection_rate: delta,
  };
}

import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import type { ContestRegistry, ScaBenchDataset, BaselineComparison, ScaBenchBaseline } from "./types.js";

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

/**
 * Error raised by {@link error}. Carries an already-logged message so the CLI
 * entrypoint can exit(1) without double-printing. Throwing (instead of
 * `process.exit`) keeps the package embeddable as a library and lets tests
 * exercise error paths without tearing down the whole test runner.
 */
export class BenchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BenchError";
  }
}

export function error(msg: string): never {
  console.error(`[bench] ERROR: ${msg}`);
  throw new BenchError(msg);
}

export interface RunStability {
  runs: number;
  mean: number;
  stddev: number;
  min: number;
  max: number;
}

/**
 * Summarize a metric across N scoring runs (population mean/stddev/min/max). The LLM
 * judge is non-deterministic, so a single "we beat GPT-5 by X%" number is unfalsifiable;
 * reporting mean ± stddev over `--runs N` makes the claim checkable. Pure/testable.
 */
export function summarizeRuns(values: number[]): RunStability {
  const runs = values.length;
  if (runs === 0) return { runs: 0, mean: 0, stddev: 0, min: 0, max: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / runs;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / runs;
  return { runs, mean, stddev: Math.sqrt(variance), min: Math.min(...values), max: Math.max(...values) };
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
   const baselineDetectionRate = baseline.scoring?.detection_rate ?? 0;
   const baselineExactMatches = baseline.scoring?.exact_matches ?? 0;
   
   if (!baseline.scoring) {
     console.warn(`[bench] Baseline scoring metadata missing for project "${baseline.project}". Using default values (0).`);
   }
  
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

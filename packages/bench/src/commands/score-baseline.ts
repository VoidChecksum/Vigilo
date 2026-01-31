import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { ensureDirs, SOURCES_DIR, TRUTH_DIR, BASELINES_DIR, loadRegistry, saveRegistry, loadBaseline, log, error } from "../utils.js";
import { scoreBaseline } from "../scorer/baseline-scorer.js";
import type { ScaBenchBaseline } from "../types.js";

interface ScoreBaselineOptions {
  iterations?: string;
  verbose?: boolean;
}

export async function scoreBaseline_(contestId: string, options: ScoreBaselineOptions = {}): Promise<void> {
  ensureDirs();

  const baselinePath = resolve(BASELINES_DIR, `baseline_${contestId}.json`);
  const truthPath = resolve(TRUTH_DIR, `${contestId}.json`);

  if (!existsSync(baselinePath)) {
    error(`No baseline found at ${baselinePath}. Run: bun bench checkout ${contestId}`);
  }
  if (!existsSync(truthPath)) {
    error(`No ground truth at ${truthPath}. Run: bun bench checkout ${contestId}`);
  }

  const baseline: ScaBenchBaseline = JSON.parse(readFileSync(baselinePath, "utf-8"));
  const truthFindings = JSON.parse(readFileSync(truthPath, "utf-8"));

  if (baseline.findings.length === 0) {
    error("Baseline has no findings to score");
  }
  if (truthFindings.length === 0) {
    error("No ground truth findings to score against");
  }

  const iterations = parseInt(options.iterations || "3", 10);
  const verbose = options.verbose ?? false;

  log(`Scoring baseline: ${baseline.project}`);
  log(`Baseline findings: ${baseline.findings.length}`);
  log(`Ground truth findings: ${truthFindings.length}`);
  log(`Iterations: ${iterations}${verbose ? ", Verbose: ON" : ""}`);
  log("");

  const startTime = Date.now();
  const scoringMetadata = await scoreBaseline(baseline, truthFindings, {
    iterations,
    verbose,
  });
  const scoringDuration = Date.now() - startTime;

  const updatedBaseline: ScaBenchBaseline = {
    ...baseline,
    scoring: scoringMetadata,
  };

  const tempPath = `${baselinePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(updatedBaseline, null, 2));
  
  const fs = await import("fs/promises");
  await fs.rename(tempPath, baselinePath);

  log("");
  log("=== Baseline Scoring Complete ===");
  log(`Exact matches:   ${scoringMetadata.exact_matches}/${scoringMetadata.truth_count}`);
  log(`Partial matches: ${scoringMetadata.partial_matches}/${scoringMetadata.truth_count}`);
  log(`Missed:          ${scoringMetadata.truth_count - scoringMetadata.exact_matches - scoringMetadata.partial_matches}/${scoringMetadata.truth_count}`);
  log("");
  log(`Detection rate:  ${(scoringMetadata.detection_rate * 100).toFixed(1)}%`);
  log(`Partial rate:    ${(scoringMetadata.partial_rate * 100).toFixed(1)}%`);
  log("");
  log(`Scoring time: ${(scoringDuration / 1000).toFixed(1)}s`);
  log(`Model used: ${scoringMetadata.model_used}`);
  log("");
  log(`Baseline updated: ${baselinePath}`);

  const registry = loadRegistry();
  const entry = registry.find((e) => e.id === contestId);
  if (entry) {
    entry.status = "baseline-scored";
    saveRegistry(registry);
  }
}

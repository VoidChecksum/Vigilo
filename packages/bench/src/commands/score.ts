import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { ensureDirs, SOURCES_DIR, TRUTH_DIR, SCORES_DIR, loadRegistry, saveRegistry, loadScorerConfig, loadBaseline, computeBaselineComparison, log, error } from "../utils.js";
import { parseVigiloFindings } from "../parsers/vigilo-findings.js";
import { runScorer } from "../scorer/llm-scorer.js";
import type { ScaBenchVulnerability } from "../types.js";

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "");
}

interface ScoreOptions {
  iterations?: string;
  batchSize?: string;
  verbose?: boolean;
}

export async function score(contestId: string, options: ScoreOptions = {}): Promise<void> {
  ensureDirs();

  const findingsDir = resolve(SOURCES_DIR, contestId, ".vigilo", "findings");
  const truthPath = resolve(TRUTH_DIR, `${contestId}.json`);

  if (!existsSync(findingsDir)) {
    error(`No Vigilo findings at ${findingsDir}. Run audit first: bun bench ${contestId}`);
  }
  if (!existsSync(truthPath)) {
    error(`No ground truth at ${truthPath}. Run: bun bench checkout ${contestId}`);
  }

  const vigiloFindings = parseVigiloFindings(findingsDir);
  const truthFindings: ScaBenchVulnerability[] = JSON.parse(readFileSync(truthPath, "utf-8"));

  if (vigiloFindings.length === 0) {
    error("No Vigilo findings found. Did you run /audit first?");
  }

  const config = loadScorerConfig(options);
  log(`Using model: ${config.model}`);
  log(`Iterations: ${config.iterations}, Batch size: ${config.batchSize}${config.verbose ? ", Verbose: ON" : ""}`);

  const startTime = Date.now();
  const result = await runScorer(contestId, truthFindings, vigiloFindings, config, null);
  const scoringDuration = Date.now() - startTime;
  result.audit_duration_ms = scoringDuration;

  const baseline = loadBaseline(contestId);
  if (baseline) {
    result.baseline_comparison = computeBaselineComparison(
      result.exact_matches,
      result.detection_rate,
      truthFindings,
      baseline
    );
    log(`Baseline loaded: ${baseline.total_findings} findings from ${result.baseline_comparison.baseline_model}`);
  }

  const contestScoreDir = resolve(SCORES_DIR, contestId);
  if (!existsSync(contestScoreDir)) {
    mkdirSync(contestScoreDir, { recursive: true });
  }
  
  const timestamp = formatTimestamp(new Date());
  const filename = `${timestamp}.json`;
  const outPath = resolve(contestScoreDir, filename);
  writeFileSync(outPath, JSON.stringify(result, null, 2));

  log("");
  log("=== Scoring Complete ===");
  log(`Exact matches:   ${result.exact_matches}/${result.total_truth}`);
  log(`Partial matches: ${result.partial_matches}/${result.total_truth}`);
  log(`Missed:          ${result.missed}/${result.total_truth}`);
  log(`False positives: ${result.false_positives}`);
  log("");
  log(`Detection rate:  ${(result.detection_rate * 100).toFixed(1)}%`);
  log(`Partial rate:    ${(result.partial_rate * 100).toFixed(1)}%`);
  log(`Precision:       ${(result.precision * 100).toFixed(1)}%`);
  log(`F1 Score:        ${(result.f1_score * 100).toFixed(1)}%`);
  log(`Severity-Weighted: ${(result.severity_weighted_score * 100).toFixed(1)}%`);
  log("");
  log(`Scoring time: ${(scoringDuration / 1000).toFixed(1)}s`);
  if (result.baseline_comparison) {
    const bc = result.baseline_comparison;
    log(`vs Baseline (${bc.baseline_model}): ${bc.vigilo_vs_baseline.toUpperCase()} (${bc.delta_detection_rate >= 0 ? '+' : ''}${(bc.delta_detection_rate * 100).toFixed(1)}%)`);
  }
  log("");
  log(`Saved to ${outPath}`);

  const registry = loadRegistry();
  const entry = registry.find((e) => e.id === contestId);
  if (entry) {
    entry.status = "scored";
    saveRegistry(registry);
  }
}

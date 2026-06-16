import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { ensureDirs, SOURCES_DIR, TRUTH_DIR, SCORES_DIR, loadRegistry, saveRegistry, loadScorerConfig, loadBaseline, computeBaselineComparison, summarizeRuns, log, error } from "../utils.js";
import { parseVigiloFindings } from "../parsers/vigilo-findings.js";
import { runScorer } from "../scorer/llm-scorer.js";
import { resetUsageTotals, getUsageTotals } from "../client/opencode.js";
import type { ScaBenchVulnerability } from "../types.js";

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "");
}

interface ScoreOptions {
  iterations?: string;
  batchSize?: string;
  verbose?: boolean;
  runs?: string;
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

  resetUsageTotals();
  const startTime = Date.now();
  const result = await runScorer(contestId, truthFindings, vigiloFindings, config, null);
  const scoringDuration = Date.now() - startTime;
  result.audit_duration_ms = scoringDuration;

  // Pick up the AUDIT run's cost, if the pipeline captured it (.vigilo/audit-cost.json).
  const auditCostPath = resolve(SOURCES_DIR, contestId, ".vigilo", "audit-cost.json");
  if (existsSync(auditCostPath)) {
    try {
      const ac = JSON.parse(readFileSync(auditCostPath, "utf-8")) as { cost_usd?: number; tokens?: number };
      result.audit_cost_usd = ac.cost_usd ?? null;
      result.audit_tokens = ac.tokens ?? null;
    } catch {
      /* ignore malformed audit-cost file */
    }
  }

  // Optional reproducibility sweep: re-score N times and report run-to-run variance,
  // so detection-rate claims are falsifiable (the LLM judge is non-deterministic).
  const runsN = Math.max(1, parseInt(options.runs || "1", 10));
  if (runsN > 1) {
    const detectionRates = [result.detection_rate];
    const f1s = [result.f1_score];
    for (let r = 2; r <= runsN; r++) {
      log(`Stability run ${r}/${runsN}...`);
      const extra = await runScorer(contestId, truthFindings, vigiloFindings, config, null);
      detectionRates.push(extra.detection_rate);
      f1s.push(extra.f1_score);
    }
    const dr = summarizeRuns(detectionRates);
    const f1 = summarizeRuns(f1s);
    result.stability = { runs: runsN, detection_rate: dr, f1_score: f1 };
    log(
      `Stability over ${runsN} runs — detection_rate ${(dr.mean * 100).toFixed(1)}% ± ${(dr.stddev * 100).toFixed(1)} ` +
        `(min ${(dr.min * 100).toFixed(1)}, max ${(dr.max * 100).toFixed(1)}); ` +
        `f1 ${(f1.mean * 100).toFixed(1)}% ± ${(f1.stddev * 100).toFixed(1)}`
    );
  }

  // Capture the scorer's own token/cost spend AFTER all scoring runs, so --runs N
  // reflects total spend rather than only the first pass (0 when the provider
  // doesn't report usage).
  const usage = getUsageTotals();
  result.scoring_cost_usd = usage.cost || null;
  result.scoring_tokens = usage.tokens || null;

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

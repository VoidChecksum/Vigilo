import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { resolve } from "path";
import { ensureDirs, SCORES_DIR, SOURCES_DIR, REPORTS_DIR, log } from "../utils.js";
import { parseVigiloFindings } from "../parsers/vigilo-findings.js";
import type { ScoreResult } from "../types.js";

interface ReportOptions {
  contest?: string;
  run?: string;
  all?: boolean;
}

function loadAllScores(): ScoreResult[] {
  const scores: ScoreResult[] = [];
  
  if (!existsSync(SCORES_DIR)) return scores;
  
  const entries = readdirSync(SCORES_DIR);
  
  for (const entry of entries) {
    const entryPath = resolve(SCORES_DIR, entry);
    const stat = statSync(entryPath);
    
    if (stat.isDirectory()) {
      const runFiles = readdirSync(entryPath).filter(f => f.endsWith(".json"));
      for (const runFile of runFiles) {
        const score = JSON.parse(readFileSync(resolve(entryPath, runFile), "utf-8"));
        scores.push(score);
      }
    } else if (entry.endsWith(".json")) {
      const score = JSON.parse(readFileSync(entryPath, "utf-8"));
      scores.push(score);
    }
  }
  
  return scores;
}

function getLatestScoreForContest(contestId: string): ScoreResult | null {
  const contestDir = resolve(SCORES_DIR, contestId);
  
  if (existsSync(contestDir) && statSync(contestDir).isDirectory()) {
    const runFiles = readdirSync(contestDir)
      .filter(f => f.endsWith(".json"))
      .sort()
      .reverse();
    
    if (runFiles.length > 0) {
      return JSON.parse(readFileSync(resolve(contestDir, runFiles[0]), "utf-8"));
    }
  }
  
  const legacyPath = resolve(SCORES_DIR, `${contestId}.json`);
  if (existsSync(legacyPath)) {
    return JSON.parse(readFileSync(legacyPath, "utf-8"));
  }
  
  return null;
}

function listRunsForContest(contestId: string): string[] {
  const contestDir = resolve(SCORES_DIR, contestId);
  if (!existsSync(contestDir) || !statSync(contestDir).isDirectory()) {
    return [];
  }
  return readdirSync(contestDir).filter(f => f.endsWith(".json")).sort().reverse();
}

export async function report(options: ReportOptions): Promise<void> {
  ensureDirs();

  if (options.contest) {
    if (options.run) {
      const runPath = resolve(SCORES_DIR, options.contest, options.run);
      if (!existsSync(runPath)) {
        log(`Run not found: ${runPath}`);
        return;
      }
      const score = JSON.parse(readFileSync(runPath, "utf-8"));
      const md = generateContestReport(score);
      const reportName = `${options.contest}_${options.run.replace(".json", "")}.md`;
      const outPath = resolve(REPORTS_DIR, reportName);
      writeFileSync(outPath, md);
      log(`Report: ${outPath}`);
      return;
    }

    const runs = listRunsForContest(options.contest);
    if (runs.length > 1) {
      log(`Found ${runs.length} runs for "${options.contest}":`);
      runs.forEach((r, i) => log(`  [${i + 1}] ${r}`));
      log(`Using latest: ${runs[0]}`);
      log(`To use specific run: bun bench report --contest ${options.contest} --run <filename>`);
    }

    const score = getLatestScoreForContest(options.contest);
    if (!score) {
      log(`No score found for "${options.contest}"`);
      return;
    }
    const md = generateContestReport(score);
    const outPath = resolve(REPORTS_DIR, `${options.contest}.md`);
    writeFileSync(outPath, md);
    log(`Report: ${outPath}`);
    return;
  }

  const scores = loadAllScores();
  if (scores.length === 0) {
    log("No scored contests found. Run: bun bench score <contest-id>");
    return;
  }

  const latestPerContest = new Map<string, ScoreResult>();
  for (const score of scores) {
    const existing = latestPerContest.get(score.project_id);
    if (!existing || score.timestamp > existing.timestamp) {
      latestPerContest.set(score.project_id, score);
    }
  }

  const md = generateAggregateReport(Array.from(latestPerContest.values()));
  const outPath = resolve(REPORTS_DIR, "REPORT.md");
  writeFileSync(outPath, md);
  log(`Aggregate report: ${outPath}`);
}

function generateVulnTypeSection(score: ScoreResult): string {
  if (!score.vuln_type_breakdown || score.vuln_type_breakdown.length === 0) {
    return "";
  }

  let section = `
## Vulnerability Type Breakdown

| Type | Findings | Matched (Truth) | Exact | Partial | Detection Rate |
|------|----------|-----------------|-------|---------|----------------|
`;
  for (const vt of score.vuln_type_breakdown) {
    section += `| ${vt.type} | ${vt.total_findings} | ${vt.total_truth} | ${vt.exact} | ${vt.partial} | ${(vt.detection_rate * 100).toFixed(1)}% |\n`;
  }
  return section;
}

function generateContestReport(score: ScoreResult): string {
  const findingsDir = resolve(SOURCES_DIR, score.project_id, ".vigilo", "findings");
  let perAuditor = "";

  if (existsSync(findingsDir)) {
    const findings = parseVigiloFindings(findingsDir);
    const auditorMap = new Map<string, { total: number; matched: number }>();

    for (const f of findings) {
      const stats = auditorMap.get(f.auditor) || { total: 0, matched: 0 };
      stats.total++;
      const isMatched = score.matches.some((m) => m.matched_finding_id === f.id && m.match_type === "exact");
      if (isMatched) stats.matched++;
      auditorMap.set(f.auditor, stats);
    }

    if (auditorMap.size > 0) {
      perAuditor = `\n## Per-Auditor Breakdown\n\n| Auditor | Findings | Matched | Hit Rate |\n|---------|----------|---------|----------|\n`;
      for (const [auditor, stats] of auditorMap) {
        const rate = stats.total > 0 ? ((stats.matched / stats.total) * 100).toFixed(1) : "0.0";
        perAuditor += `| ${auditor} | ${stats.total} | ${stats.matched} | ${rate}% |\n`;
      }
    }
  }

  let perSeveritySection = "";
  if (score.per_severity) {
    const ps = score.per_severity;
    perSeveritySection = `
## Per-Severity Breakdown

| Severity | Total | Exact | Partial | Missed | Detection Rate |
|----------|-------|-------|---------|--------|----------------|
| Critical | ${ps.critical.total} | ${ps.critical.exact} | ${ps.critical.partial} | ${ps.critical.missed} | ${(ps.critical.detection_rate * 100).toFixed(1)}% |
| High | ${ps.high.total} | ${ps.high.exact} | ${ps.high.partial} | ${ps.high.missed} | ${(ps.high.detection_rate * 100).toFixed(1)}% |
| Medium | ${ps.medium.total} | ${ps.medium.exact} | ${ps.medium.partial} | ${ps.medium.missed} | ${(ps.medium.detection_rate * 100).toFixed(1)}% |
| Low | ${ps.low.total} | ${ps.low.exact} | ${ps.low.partial} | ${ps.low.missed} | ${(ps.low.detection_rate * 100).toFixed(1)}% |
`;
  }

  let baselineSection = "";
  if (score.baseline_comparison) {
    const bc = score.baseline_comparison;
    const emoji = bc.vigilo_vs_baseline === "better" ? "🟢" : bc.vigilo_vs_baseline === "worse" ? "🔴" : "🟡";
    baselineSection = `
## Baseline Comparison (${bc.baseline_model})

| Metric | Vigilo | Baseline | Delta |
|--------|--------|----------|-------|
| Detection Rate | ${(score.detection_rate * 100).toFixed(1)}% | ${(bc.baseline_detection_rate * 100).toFixed(1)}% | ${emoji} ${bc.delta_detection_rate >= 0 ? '+' : ''}${(bc.delta_detection_rate * 100).toFixed(1)}% |
| Total Findings | ${score.total_findings} | ${bc.baseline_total_findings} | - |
`;
  }

  const durationStr = score.audit_duration_ms
    ? `_Scoring Time: ${(score.audit_duration_ms / 1000).toFixed(1)}s_\n`
    : "";

  const costParts: string[] = [];
  if (score.scoring_tokens) costParts.push(`${score.scoring_tokens.toLocaleString()} tokens`);
  if (score.scoring_cost_usd) {
    costParts.push(`$${score.scoring_cost_usd.toFixed(4)}`);
    const confirmed = score.exact_matches + score.partial_matches;
    if (confirmed > 0) costParts.push(`$${(score.scoring_cost_usd / confirmed).toFixed(4)}/confirmed`);
  }
  const costStr = costParts.length ? `_Scoring Cost: ${costParts.join(" · ")}_\n` : "";

  const auditCostParts: string[] = [];
  if (score.audit_tokens) auditCostParts.push(`${score.audit_tokens.toLocaleString()} tokens`);
  if (score.audit_cost_usd) auditCostParts.push(`$${score.audit_cost_usd.toFixed(4)}`);
  const auditCostStr = auditCostParts.length ? `_Audit Cost: ${auditCostParts.join(" · ")}_\n` : "";

  // Reproducibility sweep (`score --runs N`): surface run-to-run variance so
  // detection-rate claims are falsifiable. mean/stddev/min/max are 0..1 fractions.
  let stabilityStr = "";
  if (score.stability) {
    const s = score.stability;
    const dr = s.detection_rate;
    const f1 = s.f1_score;
    stabilityStr =
      `_Stability (${s.runs} runs): detection ${(dr.mean * 100).toFixed(1)}% ± ${(dr.stddev * 100).toFixed(1)} ` +
      `(min ${(dr.min * 100).toFixed(1)}, max ${(dr.max * 100).toFixed(1)}); ` +
      `F1 ${(f1.mean * 100).toFixed(1)}% ± ${(f1.stddev * 100).toFixed(1)}_\n`;
  }

  return `# Vigilo Benchmark — ${score.project_id}

_Generated: ${score.timestamp}_
_Model: ${score.model}_
${durationStr}${auditCostStr}${costStr}${stabilityStr}
## Summary

| Metric | Value |
|--------|-------|
| Ground Truth Vulns | ${score.total_truth} |
| Vigilo Findings | ${score.total_findings} |
| Exact Matches | ${score.exact_matches} |
| Partial Matches | ${score.partial_matches} |
| Missed | ${score.missed} |
| False Positives | ${score.false_positives} |
| **Detection Rate** | ${(score.detection_rate * 100).toFixed(1)}% |
| **Partial Rate** | ${(score.partial_rate * 100).toFixed(1)}% |
| **Precision** | ${(score.precision * 100).toFixed(1)}% |
| **F1 Score** | ${((score.f1_score ?? 0) * 100).toFixed(1)}% |
| **Severity-Weighted** | ${((score.severity_weighted_score ?? 0) * 100).toFixed(1)}% |
${baselineSection}${perSeveritySection}${generateVulnTypeSection(score)}${perAuditor}
## Match Details

| Truth | Match Type | Vigilo Finding | Explanation |
|-------|------------|----------------|-------------|
${score.matches.map((m) => `| ${m.truth_title.slice(0, 40)}... | ${m.match_type} | ${m.matched_finding_title?.slice(0, 30) || "-"} | ${m.explanation.slice(0, 50)}... |`).join("\n")}

## False Positives (Unmatched Findings)

${score.unmatched_findings.length === 0 ? "None" : score.unmatched_findings.map((f) => `- **${f.title}** (${f.severity}) — ${f.auditor}`).join("\n")}
`;
}

function generateAggregateReport(scores: ScoreResult[]): string {
  const totalTruth = scores.reduce((s, r) => s + r.total_truth, 0);
  const totalExact = scores.reduce((s, r) => s + r.exact_matches, 0);
  const totalPartial = scores.reduce((s, r) => s + r.partial_matches, 0);
  const totalMissed = scores.reduce((s, r) => s + r.missed, 0);
  const totalFP = scores.reduce((s, r) => s + r.false_positives, 0);
  const detectionRate = totalTruth > 0 ? totalExact / totalTruth : 0;
  const partialRate = totalTruth > 0 ? (totalExact + totalPartial) / totalTruth : 0;
  const precision = totalExact + totalFP > 0 ? totalExact / (totalExact + totalFP) : 0;
  const recall = detectionRate;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const avgSeverityWeighted = scores.length > 0 
    ? scores.reduce((s, r) => s + (r.severity_weighted_score ?? 0), 0) / scores.length 
    : 0;

  const totalDuration = scores.reduce((s, r) => s + (r.audit_duration_ms ?? 0), 0);

  const aggregateSeverity = {
    critical: { total: 0, exact: 0, partial: 0 },
    high: { total: 0, exact: 0, partial: 0 },
    medium: { total: 0, exact: 0, partial: 0 },
    low: { total: 0, exact: 0, partial: 0 },
  };

  for (const s of scores) {
    if (s.per_severity) {
      for (const sev of ["critical", "high", "medium", "low"] as const) {
        aggregateSeverity[sev].total += s.per_severity[sev].total;
        aggregateSeverity[sev].exact += s.per_severity[sev].exact;
        aggregateSeverity[sev].partial += s.per_severity[sev].partial;
      }
    }
  }

  return `# Vigilo Benchmark Report — ${new Date().toISOString().split("T")[0]}

## Summary

| Metric | Value |
|--------|-------|
| Contests Evaluated | ${scores.length} |
| Total Ground Truth | ${totalTruth} |
| Exact Matches | ${totalExact} |
| Partial Matches | ${totalPartial} |
| Missed | ${totalMissed} |
| False Positives | ${totalFP} |
| **Detection Rate** | ${(detectionRate * 100).toFixed(1)}% |
| **Partial Rate** | ${(partialRate * 100).toFixed(1)}% |
| **Precision** | ${(precision * 100).toFixed(1)}% |
| **F1 Score** | ${(f1Score * 100).toFixed(1)}% |
| **Avg Severity-Weighted** | ${(avgSeverityWeighted * 100).toFixed(1)}% |
| Total Scoring Time | ${(totalDuration / 1000).toFixed(1)}s |

## Aggregate Per-Severity Breakdown

| Severity | Total | Exact | Partial | Detection Rate |
|----------|-------|-------|---------|----------------|
| Critical | ${aggregateSeverity.critical.total} | ${aggregateSeverity.critical.exact} | ${aggregateSeverity.critical.partial} | ${aggregateSeverity.critical.total > 0 ? ((aggregateSeverity.critical.exact / aggregateSeverity.critical.total) * 100).toFixed(1) : 0}% |
| High | ${aggregateSeverity.high.total} | ${aggregateSeverity.high.exact} | ${aggregateSeverity.high.partial} | ${aggregateSeverity.high.total > 0 ? ((aggregateSeverity.high.exact / aggregateSeverity.high.total) * 100).toFixed(1) : 0}% |
| Medium | ${aggregateSeverity.medium.total} | ${aggregateSeverity.medium.exact} | ${aggregateSeverity.medium.partial} | ${aggregateSeverity.medium.total > 0 ? ((aggregateSeverity.medium.exact / aggregateSeverity.medium.total) * 100).toFixed(1) : 0}% |
| Low | ${aggregateSeverity.low.total} | ${aggregateSeverity.low.exact} | ${aggregateSeverity.low.partial} | ${aggregateSeverity.low.total > 0 ? ((aggregateSeverity.low.exact / aggregateSeverity.low.total) * 100).toFixed(1) : 0}% |

## Per-Contest Breakdown

| Contest | Truth | Exact | Partial | FP | Detection | F1 | Sev-Weighted |
|---------|-------|-------|---------|-----|-----------|-----|--------------|
${scores.map((s) => `| ${s.project_id.slice(0, 30)} | ${s.total_truth} | ${s.exact_matches} | ${s.partial_matches} | ${s.false_positives} | ${(s.detection_rate * 100).toFixed(1)}% | ${((s.f1_score ?? 0) * 100).toFixed(1)}% | ${((s.severity_weighted_score ?? 0) * 100).toFixed(1)}% |`).join("\n")}
`;
}

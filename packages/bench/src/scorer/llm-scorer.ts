import type { ScaBenchVulnerability, VigiloFinding, ScorerMatch, UnmatchedFinding, ScoreResult, MatchType, PerSeverityBreakdown, SeverityBreakdown, VulnTypeStats } from "../types.js";
import type { ScorerConfig } from "../utils.js";
import { log } from "../utils.js";
import { buildPrompt } from "./prompts.js";
import { initOpenCodeClient, closeOpenCodeClient, sendPrompt, type LLMResponse } from "../client/opencode.js";
import pc from "picocolors";

interface WorkingFinding extends VigiloFinding {
  originalIndex: number;
}

function normalizeText(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([)\]])([a-zA-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])([(\[])/g, '$1 $2')
    .replace(/#(\w)/g, '# $1')
    .replace(/\s+/g, ' ')
    .trim();
}

function smartTruncate(text: string, maxLen: number): string {
  const normalized = normalizeText(text);
  if (normalized.length <= maxLen) return normalized;
  const truncated = normalized.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.7) {
    return truncated.slice(0, lastSpace) + '...';
  }
  return truncated + '...';
}

function buildBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

function getMajorityVote(responses: LLMResponse[], verbose: boolean): { type: MatchType; response: LLMResponse } {
  const exactCount = responses.filter(r => r.is_match).length;
  const partialCount = responses.filter(r => r.is_partial_match && !r.is_match).length;
  const noneCount = responses.length - exactCount - partialCount;

  if (verbose) {
    log(pc.dim(`      Votes: EXACT=${exactCount}, PARTIAL=${partialCount}, NONE=${noneCount}`));
  }

  if (exactCount >= 2) {
    const exactResponse = responses.find(r => r.is_match)!;
    return { type: "exact", response: exactResponse };
  }
  
  if (partialCount >= 2) {
    const partialResponse = responses.find(r => r.is_partial_match && !r.is_match)!;
    return { type: "partial", response: partialResponse };
  }
  
  if (noneCount >= 2) {
    const noneResponse = responses.find(r => !r.is_match && !r.is_partial_match)!;
    return { type: "none", response: noneResponse };
  }

  if (exactCount === 1 && partialCount === 1 && noneCount === 1) {
    const partialResponse = responses.find(r => r.is_partial_match && !r.is_match)!;
    return { type: "partial", response: partialResponse };
  }

  return { type: "none", response: responses[0] };
}

async function runIterations(
  prompt: string,
  model: string,
  iterations: number,
  verbose: boolean
): Promise<LLMResponse[]> {
  const responses: LLMResponse[] = [];
  
  for (let i = 0; i < iterations; i++) {
    if (verbose) log(pc.dim(`      [iter ${i + 1}/${iterations}] Sending prompt to LLM...`));
    
    const startTime = Date.now();
    const response = await sendPrompt(prompt, model);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (response) {
      responses.push(response);
      if (verbose) {
        const matchType = response.is_match ? pc.green("EXACT") : response.is_partial_match ? pc.yellow("PARTIAL") : pc.red("NONE");
        const idx = response.index_of_finding_from_junior_auditor;
        log(`      [iter ${i + 1}] ${matchType} (idx=${idx}) [${elapsed}s]`);
        log(pc.cyan(`      --- LLM Response ---`));
        response.explanation.split('\n').forEach(line => {
          log(pc.white(`      ${line}`));
        });
        log("");
      }
    } else if (verbose) {
      log(pc.red(`      [iter ${i + 1}] No response [${elapsed}s]`));
    }
    
    if (responses.length >= 2) {
      const exactCount = responses.filter(r => r.is_match).length;
      const partialCount = responses.filter(r => r.is_partial_match && !r.is_match).length;
      const noneCount = responses.length - exactCount - partialCount;
      
      if (exactCount >= 2 || partialCount >= 2 || noneCount >= 2) {
        if (verbose) log(pc.cyan(`      Early consensus after ${i + 1} iterations`));
        break;
      }
    }
  }
  
  return responses;
}

async function matchTruthFinding(
  truth: ScaBenchVulnerability,
  workingSet: WorkingFinding[],
  config: ScorerConfig
): Promise<{ match: ScorerMatch; matchedIndex: number | null }> {
  const batches = buildBatches(workingSet, config.batchSize);
  let bestPartial: { response: LLMResponse; batchOffset: number } | null = null;
  let lastNoneExplanation: string = "No findings were evaluated";

  if (config.verbose) {
    log(pc.blue(`    Processing ${workingSet.length} findings in ${batches.length} batch(es)`));
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const batchOffset = batchIdx * config.batchSize;

    if (config.verbose) {
      log(pc.magenta(`    [Batch ${batchIdx + 1}/${batches.length}] Comparing against ${batch.length} findings (offset=${batchOffset})`));
      log(pc.dim(`      Findings in batch:`));
      batch.forEach((f, i) => {
        log(pc.dim(`        [${batchOffset + i + 1}] ${f.severity.toUpperCase()} - ${smartTruncate(f.title, 60)}`));
      });
    }

    const truthObj = {
      Issue: truth.title,
      Severity: truth.severity,
      Description: truth.description.slice(0, 8000),
    };

    const juniorFindings = batch.map((f, i) => ({
      Index: i,
      Issue: f.title,
      Severity: f.severity,
      Description: f.description.slice(0, 6000),
      File: f.file || "",
    }));

    const prompt = buildPrompt(truthObj, juniorFindings);
    
    if (config.verbose) {
      log(pc.dim(`      Prompt: ${prompt.length} chars`));
    }

    const responses = await runIterations(prompt, config.model, config.iterations, config.verbose);

    if (responses.length === 0) {
      if (config.verbose) log(pc.red(`      No valid responses for this batch`));
      continue;
    }

    const { type, response } = getMajorityVote(responses, config.verbose);

    if (config.verbose) {
      log(pc.cyan(`      Majority vote: ${type.toUpperCase()}`));
    }

    if (type === "exact" && response.index_of_finding_from_junior_auditor >= 0) {
      const localIdx = response.index_of_finding_from_junior_auditor;
      const globalIdx = batchOffset + localIdx;
      const matchedFinding = workingSet[globalIdx];

      if (config.verbose) {
        log(pc.green(`      EXACT MATCH found at index ${localIdx} (global: ${globalIdx})`));
        log(pc.green(`      Matched: ${matchedFinding.title.slice(0, 60)}...`));
      }

      return {
        match: {
          truth_id: truth.finding_id,
          truth_title: truth.title,
          truth_severity: truth.severity,
          matched_finding_id: matchedFinding.id,
          matched_finding_title: matchedFinding.title,
          matched_finding_severity: matchedFinding.severity,
          match_type: "exact",
          explanation: response.explanation,
        },
        matchedIndex: globalIdx,
      };
    }

    if (type === "partial" && !bestPartial && response.index_of_finding_from_junior_auditor >= 0) {
      bestPartial = { response, batchOffset };
      if (config.verbose) {
        log(pc.yellow(`      PARTIAL MATCH found, continuing to search for exact...`));
      }
    }

    if (type === "none" && response.explanation) {
      lastNoneExplanation = response.explanation;
    }
  }

  if (bestPartial) {
    const localIdx = bestPartial.response.index_of_finding_from_junior_auditor;
    const globalIdx = bestPartial.batchOffset + localIdx;
    const matchedFinding = workingSet[globalIdx];

    if (config.verbose) {
      log(pc.yellow(`    No exact match found, using best PARTIAL at index ${globalIdx}`));
    }

    return {
      match: {
        truth_id: truth.finding_id,
        truth_title: truth.title,
        truth_severity: truth.severity,
        matched_finding_id: matchedFinding.id,
        matched_finding_title: matchedFinding.title,
        matched_finding_severity: matchedFinding.severity,
        match_type: "partial",
        explanation: bestPartial.response.explanation,
      },
      matchedIndex: globalIdx,
    };
  }

  if (config.verbose) {
    log(pc.red(`    No match found for this vulnerability`));
    log(pc.cyan(`    --- LLM Reason ---`));
    lastNoneExplanation.split('\n').forEach(line => {
      log(pc.white(`    ${line}`));
    });
    log("");
  }

  return {
    match: {
      truth_id: truth.finding_id,
      truth_title: truth.title,
      truth_severity: truth.severity,
      matched_finding_id: null,
      matched_finding_title: null,
      matched_finding_severity: null,
      match_type: "none",
      explanation: lastNoneExplanation,
    },
    matchedIndex: null,
  };
}

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 2,
  low: 1,
  informational: 0,
};

function normalizeSeverity(severity: string): string {
  return severity.toLowerCase().trim();
}

function calculateSeverityWeightedScore(matches: ScorerMatch[]): number {
  let weightedHits = 0;
  let totalWeight = 0;

  for (const match of matches) {
    const sev = normalizeSeverity(match.truth_severity);
    const weight = SEVERITY_WEIGHTS[sev] ?? 1;
    totalWeight += weight;

    if (match.match_type === "exact") {
      weightedHits += weight;
    } else if (match.match_type === "partial") {
      weightedHits += weight * 0.5;
    }
  }

  return totalWeight > 0 ? weightedHits / totalWeight : 0;
}

function calculateF1Score(precision: number, recall: number): number {
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

function calculatePerSeverityBreakdown(matches: ScorerMatch[]): PerSeverityBreakdown {
  const severities = ["critical", "high", "medium", "low"] as const;
  const breakdown: PerSeverityBreakdown = {
    critical: { total: 0, exact: 0, partial: 0, missed: 0, detection_rate: 0, partial_rate: 0 },
    high: { total: 0, exact: 0, partial: 0, missed: 0, detection_rate: 0, partial_rate: 0 },
    medium: { total: 0, exact: 0, partial: 0, missed: 0, detection_rate: 0, partial_rate: 0 },
    low: { total: 0, exact: 0, partial: 0, missed: 0, detection_rate: 0, partial_rate: 0 },
  };

  for (const match of matches) {
    const sev = normalizeSeverity(match.truth_severity) as keyof PerSeverityBreakdown;
    if (!(sev in breakdown)) continue;

    breakdown[sev].total++;
    if (match.match_type === "exact") {
      breakdown[sev].exact++;
    } else if (match.match_type === "partial") {
      breakdown[sev].partial++;
    } else {
      breakdown[sev].missed++;
    }
  }

  for (const sev of severities) {
    const b = breakdown[sev];
    b.detection_rate = b.total > 0 ? b.exact / b.total : 0;
    b.partial_rate = b.total > 0 ? (b.exact + b.partial) / b.total : 0;
  }

  return breakdown;
}

function calculateVulnTypeBreakdown(
  matches: ScorerMatch[],
  vigiloFindings: VigiloFinding[]
): VulnTypeStats {
  const auditorMap = new Map<string, { truth: number; findings: number; exact: number; partial: number }>();

  for (const finding of vigiloFindings) {
    const type = finding.auditor;
    const stats = auditorMap.get(type) || { truth: 0, findings: 0, exact: 0, partial: 0 };
    stats.findings++;
    auditorMap.set(type, stats);
  }

  for (const match of matches) {
    if (match.matched_finding_id) {
      const finding = vigiloFindings.find(f => f.id === match.matched_finding_id);
      if (finding) {
        const type = finding.auditor;
        const stats = auditorMap.get(type) || { truth: 0, findings: 0, exact: 0, partial: 0 };
        stats.truth++;
        if (match.match_type === "exact") stats.exact++;
        else if (match.match_type === "partial") stats.partial++;
        auditorMap.set(type, stats);
      }
    }
  }

  const result: VulnTypeStats = [];
  for (const [type, stats] of auditorMap) {
    result.push({
      type,
      total_truth: stats.truth,
      total_findings: stats.findings,
      exact: stats.exact,
      partial: stats.partial,
      detection_rate: stats.truth > 0 ? stats.exact / stats.truth : 0,
    });
  }

  return result.sort((a, b) => b.total_findings - a.total_findings);
}

export async function runScorer(
  contestId: string,
  truthFindings: ScaBenchVulnerability[],
  vigiloFindings: VigiloFinding[],
  config: ScorerConfig,
  auditDurationMs: number | null = null
): Promise<ScoreResult> {
  await initOpenCodeClient(config.model);

  const workingSet: WorkingFinding[] = vigiloFindings.map((f, i) => ({
    ...f,
    originalIndex: i,
  }));

  const matches: ScorerMatch[] = [];
  const matchedIndices = new Set<number>();

  log(`Scoring ${truthFindings.length} ground truth vulns against ${vigiloFindings.length} Vigilo findings...`);
  
  if (config.verbose) {
    log(pc.blue(`\n=== Ground Truth Vulnerabilities ===`));
    truthFindings.forEach((t, i) => {
      log(pc.dim(`  [${i + 1}] ${t.severity.toUpperCase()} - ${smartTruncate(t.title, 70)}`));
    });
    log(pc.blue(`\n=== Vigilo Findings ===`));
    vigiloFindings.forEach((f, i) => {
      log(pc.dim(`  [${i + 1}] ${f.severity.toUpperCase()} - ${smartTruncate(f.title, 70)}`));
    });
    log("");
  }

  for (let i = 0; i < truthFindings.length; i++) {
    const truth = truthFindings[i];
    
    if (config.verbose) {
      log(pc.bold(pc.white(`\n${"=".repeat(80)}`)));
      log(pc.bold(pc.white(`[${i + 1}/${truthFindings.length}] EVALUATING GROUND TRUTH`)));
      log(pc.bold(pc.white(`${"=".repeat(80)}`)));
      log(pc.cyan(`  Title: ${normalizeText(truth.title)}`));
      log(pc.cyan(`  Severity: ${truth.severity}`));
      log(pc.cyan(`  ID: ${truth.finding_id}`));
      log(pc.dim(`  Description: ${smartTruncate(truth.description, 300)}`));
    } else {
      log(`[${i + 1}/${truthFindings.length}] Evaluating: ${smartTruncate(truth.title, 60)}`);
    }

    const availableFindings = workingSet.filter((_, idx) => !matchedIndices.has(idx));
    
    if (config.verbose) {
      log(pc.blue(`    Available findings to compare: ${availableFindings.length} (${matchedIndices.size} already matched)`));
    }
    
    const { match, matchedIndex } = await matchTruthFinding(truth, availableFindings, config);
    matches.push(match);

    if (matchedIndex !== null) {
      const originalIdx = availableFindings[matchedIndex].originalIndex;
      matchedIndices.add(originalIdx);
      
      if (config.verbose) {
        const color = match.match_type === "exact" ? pc.green : pc.yellow;
        log(color(`\n  ╔═ RESULT: ${match.match_type.toUpperCase()} ${"═".repeat(60)}`));
        log(color(`  ║ Matched: ${match.matched_finding_title}`));
        log(color(`  ╠═ Final Explanation ${"═".repeat(50)}`));
        match.explanation.split('\n').forEach(line => {
          log(pc.white(`  ║ ${line}`));
        });
        log(color(`  ╚${"═".repeat(70)}`));
      } else {
        log(`  -> ${match.match_type.toUpperCase()}: ${match.matched_finding_title?.slice(0, 50)}...`);
      }
    } else {
      if (config.verbose) {
        log(pc.red(`\n  ╔═ RESULT: NONE (no match found) ${"═".repeat(45)}`));
        log(pc.red(`  ╠═ Final Explanation ${"═".repeat(50)}`));
        match.explanation.split('\n').forEach(line => {
          log(pc.white(`  ║ ${line}`));
        });
        log(pc.red(`  ╚${"═".repeat(70)}`));
      } else {
        log(`  -> ${match.match_type.toUpperCase()}`);
      }
    }
  }

  await closeOpenCodeClient();

  const unmatchedFindings: UnmatchedFinding[] = vigiloFindings
    .filter((f, i) => !matchedIndices.has(i))
    .filter(f => f.severity !== "informational")
    .map(f => ({
      finding_id: f.id,
      title: f.title,
      severity: f.severity,
      auditor: f.auditor,
    }));

  const exactMatches = matches.filter(m => m.match_type === "exact").length;
  const partialMatches = matches.filter(m => m.match_type === "partial").length;
  const missed = matches.filter(m => m.match_type === "none").length;
  const falsePositives = unmatchedFindings.length;

  const recall = truthFindings.length > 0 ? exactMatches / truthFindings.length : 0;
  const precision = exactMatches + falsePositives > 0 ? exactMatches / (exactMatches + falsePositives) : 0;
  const f1Score = calculateF1Score(precision, recall);
  const severityWeightedScore = calculateSeverityWeightedScore(matches);
  const perSeverity = calculatePerSeverityBreakdown(matches);
  const vulnTypeBreakdown = calculateVulnTypeBreakdown(matches, vigiloFindings);

  return {
    project_id: contestId,
    timestamp: new Date().toISOString(),
    model: config.model,
    matches,
    unmatched_findings: unmatchedFindings,
    total_truth: truthFindings.length,
    exact_matches: exactMatches,
    partial_matches: partialMatches,
    missed,
    total_findings: vigiloFindings.length,
    false_positives: falsePositives,
    detection_rate: recall,
    partial_rate: truthFindings.length > 0 ? (exactMatches + partialMatches) / truthFindings.length : 0,
    precision,
    recall,
    f1_score: f1Score,
    severity_weighted_score: severityWeightedScore,
    per_severity: perSeverity,
    vuln_type_breakdown: vulnTypeBreakdown,
    audit_duration_ms: auditDurationMs,
    baseline_comparison: null,
  };
}

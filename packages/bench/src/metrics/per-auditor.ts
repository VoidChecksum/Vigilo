import type { VigiloFinding, ScoreResult } from "../types.js";

export interface AuditorMetrics {
  auditor: string;
  totalFindings: number;
  matchedFindings: number;
  partialFindings: number;
  falsePositives: number;
  hitRate: number;
}

export function computePerAuditorMetrics(findings: VigiloFinding[], scores: ScoreResult): AuditorMetrics[] {
  const auditorMap = new Map<string, AuditorMetrics>();

  for (const finding of findings) {
    if (!auditorMap.has(finding.auditor)) {
      auditorMap.set(finding.auditor, {
        auditor: finding.auditor,
        totalFindings: 0,
        matchedFindings: 0,
        partialFindings: 0,
        falsePositives: 0,
        hitRate: 0,
      });
    }

    const metrics = auditorMap.get(finding.auditor)!;
    metrics.totalFindings++;

    const match = scores.matches.find((m) => m.matched_finding_id === finding.id);
    if (match) {
      if (match.match_type === "exact") metrics.matchedFindings++;
      else if (match.match_type === "partial") metrics.partialFindings++;
    }
    
    const isFP = scores.unmatched_findings.some((f) => f.finding_id === finding.id);
    if (isFP) metrics.falsePositives++;
  }

  for (const metrics of auditorMap.values()) {
    metrics.hitRate = metrics.totalFindings > 0 ? metrics.matchedFindings / metrics.totalFindings : 0;
  }

  return [...auditorMap.values()].sort((a, b) => b.hitRate - a.hitRate);
}

export type Severity = "critical" | "high" | "medium" | "low" | "informational";

export interface ScaBenchCodebase {
  codebase_id: string;
  repo_url: string;
  commit: string;
  tree_url: string;
  tarball_url: string;
}

export interface ScaBenchVulnerability {
  finding_id: string;
  severity: string;
  title: string;
  description: string;
}

export interface ScaBenchProject {
  project_id: string;
  name: string;
  platform: string;
  codebases: ScaBenchCodebase[];
  vulnerabilities: ScaBenchVulnerability[];
}

export type ScaBenchDataset = ScaBenchProject[];

export interface VigiloFinding {
  id: string;
  title: string;
  severity: Severity;
  auditor: string;
  description: string;
  file?: string;
  filePath: string;
}

export type MatchType = "exact" | "partial" | "none";

export interface ScorerMatch {
  truth_id: string;
  truth_title: string;
  truth_severity: string;
  matched_finding_id: string | null;
  matched_finding_title: string | null;
  matched_finding_severity: string | null;
  match_type: MatchType;
  explanation: string;
}

export interface UnmatchedFinding {
  finding_id: string;
  title: string;
  severity: string;
  auditor: string;
}

export interface SeverityBreakdown {
  total: number;
  exact: number;
  partial: number;
  missed: number;
  detection_rate: number;
  partial_rate: number;
}

export interface PerSeverityBreakdown {
  critical: SeverityBreakdown;
  high: SeverityBreakdown;
  medium: SeverityBreakdown;
  low: SeverityBreakdown;
}

export interface BaselineComparison {
  baseline_model: string;
  baseline_total_findings: number;
  baseline_exact_matches: number;
  baseline_detection_rate: number;
  vigilo_vs_baseline: "better" | "worse" | "equal";
  delta_detection_rate: number;
}

export interface VulnTypeBreakdown {
  type: string;
  total_truth: number;
  total_findings: number;
  exact: number;
  partial: number;
  detection_rate: number;
}

export type VulnTypeStats = VulnTypeBreakdown[];

export interface ScoreResult {
  project_id: string;
  timestamp: string;
  model: string;
  matches: ScorerMatch[];
  unmatched_findings: UnmatchedFinding[];
  total_truth: number;
  exact_matches: number;
  partial_matches: number;
  missed: number;
  total_findings: number;
  false_positives: number;
  detection_rate: number;
  partial_rate: number;
  precision: number;
  recall: number;
  f1_score: number;
  severity_weighted_score: number;
  per_severity: PerSeverityBreakdown;
  vuln_type_breakdown: VulnTypeStats;
  audit_duration_ms: number | null;
  baseline_comparison: BaselineComparison | null;
}

export type ContestStatus = "pending" | "audited" | "scored" | "baseline-scored";

export interface ContestEntry {
  id: string;
  project_id: string;
  repo: string;
  commit: string;
  status: ContestStatus;
  lastRun: string | null;
  cost: number | null;
}

export type ContestRegistry = ContestEntry[];

export interface ScoringMetadata {
  detection_rate: number;
  partial_rate: number;
  truth_file: string;
  truth_count: number;
  exact_matches: number;
  partial_matches: number;
  scored_at: string;
  model_used: string;
  iterations: number;
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
  scoring?: ScoringMetadata;
}

import type { ScaBenchDataset, ScaBenchVulnerability } from "../types.js";

export function extractTruth(dataset: ScaBenchDataset, projectId: string): ScaBenchVulnerability[] {
  const project = dataset.find((p) => p.project_id === projectId);
  if (!project) return [];
  return project.vulnerabilities;
}

export function listProjects(dataset: ScaBenchDataset): Array<{ id: string; name: string; platform: string; vulnCount: number }> {
  return dataset.map((p) => ({
    id: p.project_id,
    name: p.name,
    platform: p.platform,
    vulnCount: p.vulnerabilities.length,
  }));
}

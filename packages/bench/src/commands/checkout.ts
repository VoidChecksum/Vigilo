import { existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import { loadDataset, loadRegistry, saveRegistry, ensureDirs, SOURCES_DIR, TRUTH_DIR, shell, log, error } from "../utils.js";
import type { ContestEntry } from "../types.js";

export async function checkout(contestId: string): Promise<void> {
  ensureDirs();

  const dataset = loadDataset();
  const project = dataset.find((p) => p.project_id === contestId);
  if (!project) {
    error(`Contest "${contestId}" not found in dataset. Available:\n${dataset.map((p) => `  - ${p.project_id}`).join("\n")}`);
  }

  const codebase = project.codebases[0];
  if (!codebase) {
    error(`No codebase found for "${contestId}"`);
  }

  const sourceDir = resolve(SOURCES_DIR, contestId);
  if (existsSync(sourceDir)) {
    log(`Source already exists at ${sourceDir}, skipping clone`);
  } else {
    log(`Cloning ${codebase.repo_url} @ ${codebase.commit}...`);
    shell(`git clone ${codebase.repo_url} "${sourceDir}"`);
    shell(`git checkout ${codebase.commit}`, sourceDir);
    log(`Cloned to ${sourceDir}`);
  }

  const truthPath = resolve(TRUTH_DIR, `${contestId}.json`);
  const truth = project.vulnerabilities.map((v) => ({
    finding_id: v.finding_id,
    severity: v.severity,
    title: v.title,
    description: v.description,
  }));
  writeFileSync(truthPath, JSON.stringify(truth, null, 2));
  log(`Extracted ${truth.length} ground truth vulnerabilities to ${truthPath}`);

  const registry = loadRegistry();
  const existing = registry.find((e) => e.id === contestId);
  if (!existing) {
    const entry: ContestEntry = {
      id: contestId,
      project_id: project.project_id,
      repo: codebase.repo_url,
      commit: codebase.commit,
      status: "pending",
      lastRun: null,
      cost: null,
    };
    registry.push(entry);
    saveRegistry(registry);
    log(`Registered contest "${contestId}" in registry`);
  }

  log(`Done. Next: cd ${sourceDir} && opencode → /audit`);
}

#!/usr/bin/env bun
import { Command } from "commander";
import { checkout } from "./commands/checkout.js";
import { score } from "./commands/score.js";
import { report } from "./commands/report.js";
import { pipeline } from "./commands/pipeline.js";

const program = new Command()
  .name("bench")
  .description("Vigilo audit benchmarking pipeline")
  .version("0.1.0");

program
  .argument("<contest-id>", "Contest ID from ScaBench dataset")
  .option("-v, --verbose", "Show detailed output")
  .option("-w, --watch", "Open OpenCode TUI to watch audit progress")
  .option("--skip-audit", "Skip audit step (use existing .vigilo/)")
  .action(pipeline);

program
  .command("checkout <contest-id>")
  .description("Clone contest source from ScaBench dataset and extract ground truth")
  .action(checkout);

program
  .command("score <contest-id>")
  .description("Score Vigilo findings against ground truth using LLM")
  .option("--iterations <n>", "Number of LLM iterations for majority voting", "3")
  .option("--batch-size <n>", "Findings per batch", "10")
  .option("-v, --verbose", "Show detailed scoring process (prompts, iterations, votes)")
  .action(score);

program
  .command("report")
  .description("Generate markdown benchmark report")
  .option("--contest <id>", "Single contest report")
  .option("--run <filename>", "Specific run file (e.g., 2026-01-28T14-42-01_claude-opus-4-5.json)")
  .option("--all", "Aggregate report across all scored contests")
  .action(report);

program.parse();

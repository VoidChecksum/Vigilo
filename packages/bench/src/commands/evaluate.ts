import { score } from "./score.js";
import { report } from "./report.js";
import { log } from "../utils.js";

export async function evaluate(contestId: string): Promise<void> {
  log(`Running full evaluation for "${contestId}"...`);

  await score(contestId);
  await report({ contest: contestId });

  log(`Evaluation complete for "${contestId}"`);
}

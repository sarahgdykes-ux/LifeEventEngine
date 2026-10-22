import { randomUUID } from "node:crypto";
import { AGENT_NAMES, OPTION_IDS } from "@/lib/agents/types";
import { OptimistAgent } from "@/lib/agents/optimist";
import type { DecisionInput } from "@/lib/schemas/decision";
import type { SimulationReport } from "@/lib/schemas/simulation";
import { validateAgentResults, validateSimulationReport } from "@/lib/validation";

const optimist = new OptimistAgent();

export async function runSimulation(decision: DecisionInput): Promise<SimulationReport> {
  const unvalidatedResults = await Promise.all(
    decision.options.map((option) => optimist.analyze(decision, option)),
  );
  const results = validateAgentResults(unvalidatedResults);
  const resultIds = new Set(results.map((result) => `${result.agent}:${result.optionId}`));
  const missingResults = AGENT_NAMES.flatMap((agent) => OPTION_IDS.map((optionId) => `${agent}:${optionId}`))
    .filter((identifier) => !resultIds.has(identifier));

  return validateSimulationReport({
    decisionId: randomUUID(),
    results,
    reportStatus: missingResults.length > 0 ? "partial" : "complete",
    missingResults,
  });
}
import { randomUUID } from "node:crypto";
import { AGENT_NAMES, OPTION_IDS, type SpecialistAgent } from "@/lib/agents/types";
import { OptimistAgent } from "@/lib/agents/optimist";
import type { DecisionInput } from "@/lib/schemas/decision";
import type { AgentResult, SimulationReport } from "@/lib/schemas/simulation";
import { validateAgentResult, validateAgentResults, validateSimulationReport } from "@/lib/validation";

const optimist = new OptimistAgent();

export async function runSimulation(
  decision: DecisionInput,
  agent: SpecialistAgent = optimist,
): Promise<SimulationReport> {
  const candidates = await Promise.all(decision.options.map(async (option) => {
    try {
      const result = validateAgentResult(await agent.analyze(decision, option));
      if (result.agent !== agent.name || result.optionId !== option.id) {
        throw new Error("Agent result does not match its requested key");
      }
      return result;
    } catch (error) {
      console.error("Simulation agent result rejected", {
        key: `${agent.name}:${option.id}`,
        failureType: error instanceof Error && error.name === "ZodError" ? "invalid_output" : "agent_error",
      });
      return undefined;
    }
  }));
  const usableResults = candidates.filter((result): result is AgentResult => result !== undefined);
  if (usableResults.length === 0) {
    throw new Error("No usable simulation results");
  }

  const results = validateAgentResults(usableResults);
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
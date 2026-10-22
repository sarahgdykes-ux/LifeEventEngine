import { randomUUID } from "node:crypto";
import { AGENT_NAMES, OPTION_IDS, type SpecialistAgent } from "@/lib/agents/types";
import { FinancialAgent } from "@/lib/agents/financial";
import { OptimistAgent } from "@/lib/agents/optimist";
import { PessimistAgent } from "@/lib/agents/pessimist";
import { WellbeingAgent } from "@/lib/agents/wellbeing";
import type { DecisionInput } from "@/lib/schemas/decision";
import type { AgentResult, SimulationReport } from "@/lib/schemas/simulation";
import { narrator, type Narrator } from "@/lib/narrator";
import {
  validateAgentResult,
  validateCompleteAgentHandoff,
  validateSimulationReport,
} from "@/lib/validation";

export const SPECIALIST_AGENTS: readonly SpecialistAgent[] = [
  new OptimistAgent(),
  new PessimistAgent(),
  new FinancialAgent(),
  new WellbeingAgent(),
];

export async function runSimulation(
  decision: DecisionInput,
  agents: readonly SpecialistAgent[] = SPECIALIST_AGENTS,
  narratorAgent: Narrator = narrator,
): Promise<SimulationReport> {
  const agentNames = new Set(agents.map(({ name }) => name));
  if (agents.length !== AGENT_NAMES.length || agentNames.size !== AGENT_NAMES.length || AGENT_NAMES.some((name) => !agentNames.has(name))) {
    throw new Error("Simulation requires exactly one implementation of each specialist");
  }

  const candidates = await Promise.all(agents.flatMap((agent) => decision.options.map(async (option) => {
    try {
      const result = validateAgentResult(await agent.analyze(decision, option));
      if (result.agent !== agent.name || result.optionId !== option.id) {
        throw new Error("Agent result does not match its requested key");
      }
      console.info("Simulation agent output schema validated", {
        agent: result.agent,
        optionId: result.optionId,
        schemaValid: true,
      });
      return result;
    } catch (error) {
      console.error("Simulation agent result rejected", {
        key: `${agent.name}:${option.id}`,
        failureType: error instanceof Error && error.name === "ZodError" ? "invalid_output" : "agent_error",
        schemaValid: false,
      });
      return undefined;
    }
  })));
  const usableResults = candidates.filter((result): result is AgentResult => result !== undefined);
  const completeResults = validateCompleteAgentHandoff(usableResults);
  console.info("Simulation narrator handoff started", {
    validatedResultCount: completeResults.length,
  });
  const synthesis = narratorAgent.synthesize(completeResults, decision.options);
  const results = completeResults;
  const missingResults: string[] = [];

  return validateSimulationReport({
    decisionId: randomUUID(),
    results,
    synthesis,
    reportStatus: "complete",
    missingResults,
  });
}
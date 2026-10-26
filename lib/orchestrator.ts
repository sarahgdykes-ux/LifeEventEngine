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

interface AgentAttempt {
  result?: AgentResult;
  matchesRequestedKey: boolean;
}

export async function runSimulation(
  decision: DecisionInput,
  agents: readonly SpecialistAgent[] = SPECIALIST_AGENTS,
  narratorAgent: Narrator = narrator,
): Promise<SimulationReport> {
  const candidates = await Promise.all(agents.flatMap((agent) => decision.options.map(async (option) => {
    const requestedKey = `${agent.name}:${option.id}`;
    let output: unknown;

    try {
      output = await agent.analyze(decision, option);
    } catch (error) {
      console.error("Simulation agent result rejected", {
        key: requestedKey,
        failureType: "agent_error",
        schemaValid: false,
      });
      return { matchesRequestedKey: false } satisfies AgentAttempt;
    }

    let result: AgentResult;
    try {
      result = validateAgentResult(output);
    } catch {
      console.error("Simulation agent result rejected", {
        key: requestedKey,
        failureType: "invalid_output",
        schemaValid: false,
      });
      return { matchesRequestedKey: false } satisfies AgentAttempt;
    }

    const matchesRequestedKey = result.agent === agent.name && result.optionId === option.id;
    if (!matchesRequestedKey) {
      console.error("Simulation agent result rejected", {
        key: requestedKey,
        failureType: "key_mismatch",
        schemaValid: true,
      });
      return { result, matchesRequestedKey } satisfies AgentAttempt;
    }

    console.info("Simulation agent output schema validated", {
      agent: result.agent,
      optionId: result.optionId,
      schemaValid: true,
    });
    return { result, matchesRequestedKey } satisfies AgentAttempt;
  })));

  const attemptsByResultKey = new Map<string, AgentAttempt[]>();
  candidates.forEach((attempt) => {
    if (!attempt.result || !attempt.matchesRequestedKey) return;
    const resultKey = `${attempt.result.agent}:${attempt.result.optionId}`;
    const attempts = attemptsByResultKey.get(resultKey) ?? [];
    attempts.push(attempt);
    attemptsByResultKey.set(resultKey, attempts);
  });

  const results = candidates.flatMap((attempt) => {
    if (!attempt.result || !attempt.matchesRequestedKey) return [];
    const resultKey = `${attempt.result.agent}:${attempt.result.optionId}`;
    const matchingAttempts = attemptsByResultKey.get(resultKey) ?? [];
    if (matchingAttempts.length > 1) {
      if (matchingAttempts[0] === attempt) {
        console.error("Simulation duplicate agent results rejected", {
          key: resultKey,
          duplicateCount: matchingAttempts.length,
        });
      }
      return [];
    }
    return [attempt.result];
  });

  const expectedKeys = AGENT_NAMES.flatMap((agent) => decision.options.map(({ id }) => `${agent}:${id}`));
  const completeResultKeys = new Set(
    results.filter((result) => result.status === "complete")
      .map((result) => `${result.agent}:${result.optionId}`),
  );
  const missingResults = expectedKeys.filter((key) => !completeResultKeys.has(key));
  const reportStatus = missingResults.length === 0
    ? "complete"
    : completeResultKeys.size > 0
      ? "partial"
      : "failed";

  let synthesis: SimulationReport["synthesis"] = null;
  if (reportStatus === "complete") {
    const completeResults = validateCompleteAgentHandoff(results);
    console.info("Simulation narrator handoff started", {
      validatedResultCount: completeResults.length,
    });
    synthesis = narratorAgent.synthesize(completeResults, decision.options);
  }

  return validateSimulationReport({
    decisionId: randomUUID(),
    results,
    synthesis,
    reportStatus,
    missingResults,
  });
}
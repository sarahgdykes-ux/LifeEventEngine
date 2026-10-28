import type { AgentName, SpecialistAgent } from "@/lib/agents/types";
import type { DecisionInput, DecisionOption } from "@/lib/schemas/decision";
import { AgentResultSchema, type AgentResult } from "@/lib/schemas/simulation";
import { generateStructuredAgentOutput } from "@/lib/llm/adapter";

const ROLE_GUIDANCE: Record<AgentName, string> = {
  optimist: "Focus on plausible opportunities, growth, and benefits while identifying what would make them achievable.",
  pessimist: "Stress-test the option for obstacles, failure modes, early warning signs, and reversible fallbacks.",
  financial: "Focus on costs, income, savings, debt, and affordability. Do not invent monetary figures.",
  wellbeing: "Focus on stress, relationships, health, daily routine, and fulfillment. Do not diagnose or make clinical claims.",
};

export interface LiveAgentExecution {
  result: AgentResult;
  retriesUsed: number;
}

export async function useLiveAgentExecution(
  name: AgentName,
  decision: DecisionInput,
  option: DecisionOption,
  fallback: AgentResult,
): Promise<LiveAgentExecution> {
  try {
    const generated = await generateStructuredAgentOutput({
      schema: AgentResultSchema,
      systemPrompt: [
        `You are the ${name} specialist in a life decision simulator. ${ROLE_GUIDANCE[name]}`,
        "Return careful, distinct analysis grounded only in the supplied context. Separate assumptions from facts, name uncertainties, avoid predicting that any outcome will occur, and keep confidence as cautious self-reported confidence rather than probability.",
        "This is educational reflection, not professional financial, medical, legal, or clinical advice. Include all required fields and the requested agent and option identifiers.",
      ].join(" "),
      prompt: JSON.stringify({ agent: name, optionId: option.id, decision, option }),
    });
    if (!generated) return { result: fallback, retriesUsed: 0 };
    // Handoff identity is controlled by the orchestrator, not model output.
    return {
      result: AgentResultSchema.parse({ ...generated.data, agent: name, optionId: option.id }),
      retriesUsed: generated.retriesUsed,
    };
  } catch {
    // Provider/network failures retain the existing offline-capable result.
    return { result: fallback, retriesUsed: 0 };
  }
}

export async function useLiveAgentResult(
  name: AgentName,
  decision: DecisionInput,
  option: DecisionOption,
  fallback: AgentResult,
): Promise<AgentResult> {
  return (await useLiveAgentExecution(name, decision, option, fallback)).result;
}

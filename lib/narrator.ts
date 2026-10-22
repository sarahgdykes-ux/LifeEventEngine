import { AGENT_NAMES, type AgentName } from "@/lib/agents/types";
import type { DecisionOption } from "@/lib/schemas/decision";
import {
  SimulationSynthesisSchema,
  type AgentResult,
  type SimulationSynthesis,
} from "@/lib/schemas/simulation";
import { validateCompleteAgentHandoff } from "@/lib/validation";

const HORIZONS = ["year1", "year5", "year10"] as const;

export class Narrator {
  synthesize(results: AgentResult[], options: DecisionOption[]): SimulationSynthesis {
    const completeResults = validateCompleteAgentHandoff(results);
    const resultsByKey = new Map(
      completeResults.map((result) => [`${result.agent}:${result.optionId}`, result]),
    );

    const synthesis = {
      options: options.map((option) => {
        const resultFor = (agent: AgentName) => resultsByKey.get(`${agent}:${option.id}`);
        const financial = resultFor("financial");
        const wellbeing = resultFor("wellbeing");
        const pessimist = resultFor("pessimist");
        if (!financial || !wellbeing || !pessimist) {
          throw new Error("Narrator received an incomplete specialist handoff");
        }

        const financialHealth = financial.scores.financialHealth;
        const emotionalWellbeing = wellbeing.scores.emotionalWellbeing;
        const riskLevel = pessimist.scores.riskLevel;
        if (!financialHealth || !emotionalWellbeing || !riskLevel) {
          throw new Error("Narrator received a specialist result without its required score");
        }

        return {
          optionId: option.id,
          timeline: Object.fromEntries(HORIZONS.map((horizon) => [
            horizon,
            AGENT_NAMES.map((agent) => {
              const result = resultFor(agent);
              if (!result) {
                throw new Error("Narrator received an incomplete specialist handoff");
              }
              return { agent, projection: result.projections[horizon] };
            }),
          ])),
          breakdownScores: { financialHealth, emotionalWellbeing, riskLevel },
        };
      }),
    };

    return SimulationSynthesisSchema.parse(synthesis);
  }
}

export const narrator = new Narrator();

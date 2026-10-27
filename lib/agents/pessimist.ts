import type { DecisionInput, DecisionOption } from "@/lib/schemas/decision";
import type { AgentResult } from "@/lib/schemas/simulation";
import type { SpecialistAgent } from "@/lib/agents/types";
import { describeDecisionContext } from "@/lib/agents/context";

export class PessimistAgent implements SpecialistAgent {
  readonly name = "pessimist" as const;

  async analyze(decision: DecisionInput, option: DecisionOption): Promise<AgentResult> {
    const context = describeDecisionContext(decision, option);

    return {
      agent: this.name,
      optionId: option.id,
      findings: [
        `Risk review for "${context.question}": for ${context.option}, test how a setback could interfere with the goals of ${context.goals}, especially the priorities of ${context.priorities}.`,
        `Check whether the constraints (${context.constraints}) could make the option difficult to sustain, and identify an early warning sign and a reversible fallback.`,
        `Check the downside against the supplied starting state: ${context.baseline}`,
      ],
      assumptions: [
        `This is an illustrative downside scenario, not a verified fact or prediction; it assumes an unexpected obstacle could limit progress on ${context.goals}.`,
      ],
      confidence: 40,
      uncertainties: [
        `The probability and impact of any specific setback cannot be estimated from the information provided; details about ${context.constraints} may change the risk review.`,
        `The decision context does not establish how much risk the user is willing to accept in pursuing ${context.priorities}.`,
      ],
      projections: {
        year1: `Illustrative check, not a forecast: monitor early setbacks to ${context.option} that could conflict with ${context.constraints}, and decide what would trigger a pause or fallback.`,
        year5: `Illustrative check, not a forecast: revisit whether the demands of ${context.option} still leave room for ${context.goals} and the priority of ${context.priorities}.`,
        year10: `Illustrative check, not a forecast: retain flexibility because future responsibilities and circumstances related to "${context.question}" are unknown.`,
      },
      scores: {
        riskLevel: {
          value: 50,
          rationale: "Neutral placeholder only, not an estimated likelihood or severity: the prompt does not provide evidence to quantify risks to the stated goals or constraints.",
        },
      },
      status: "complete",
    };
  }
}

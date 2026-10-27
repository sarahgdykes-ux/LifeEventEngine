import type { DecisionInput, DecisionOption } from "@/lib/schemas/decision";
import type { AgentResult } from "@/lib/schemas/simulation";
import type { SpecialistAgent } from "@/lib/agents/types";
import { describeDecisionContext } from "@/lib/agents/context";

export class WellbeingAgent implements SpecialistAgent {
  readonly name = "wellbeing" as const;

  async analyze(decision: DecisionInput, option: DecisionOption): Promise<AgentResult> {
    const context = describeDecisionContext(decision, option);

    return {
      agent: this.name,
      optionId: option.id,
      findings: [
        `For "${context.question}", consider how the day-to-day experience of ${context.option} could support or strain the goal of ${context.goals}, and how that fits the priority of ${context.priorities}.`,
        `Explore likely effects to monitor in stress, relationships, health, and routine, especially where the constraint(s) ${context.constraints} might add pressure.`,
        `Compare any assumed wellbeing changes with the user-supplied starting point: ${context.baseline}`,
      ],
      assumptions: [
        `This is a reflection scenario, not a clinical assessment or prediction; it assumes the user can notice how ${context.option} affects daily life and adjust where possible.`,
      ],
      confidence: 35,
      uncertainties: [
        `The emotional, physical, and relationship effects of ${context.option} are personal and cannot be measured from the question alone.`,
        `The prompt does not describe the user's current wellbeing, support network, or how they prioritize ${context.priorities} against other needs.`,
      ],
      projections: {
        year1: `Illustrative check-in, not a forecast: notice how settling into ${context.option} affects stress, connection, health, and the goal of ${context.goals}.`,
        year5: `Illustrative check-in, not a forecast: revisit whether the routine and relationships associated with ${context.option} still support ${context.priorities} within ${context.constraints}.`,
        year10: `Illustrative check-in, not a forecast: reassess whether ${context.option} continues to feel aligned with ${context.goals}, since wellbeing and priorities can change.`,
      },
      scores: {
        emotionalWellbeing: {
          value: 50,
          rationale: "Neutral placeholder only, not a wellbeing estimate: no validated measure or personal baseline was supplied.",
        },
      },
      status: "complete",
    };
  }
}

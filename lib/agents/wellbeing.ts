import type { DecisionInput, DecisionOption } from "@/lib/schemas/decision";
import type { AgentResult } from "@/lib/schemas/simulation";
import type { SpecialistAgent } from "@/lib/agents/types";

export class WellbeingAgent implements SpecialistAgent {
  readonly name = "wellbeing" as const;

  async analyze(decision: DecisionInput, option: DecisionOption): Promise<AgentResult> {
    return {
      agent: this.name,
      optionId: option.id,
      findings: [
        `Wellbeing reflection: consider how ${option.label.toLowerCase()} could affect stress, relationships, daily routines, and alignment with the user's priorities.`,
      ],
      assumptions: [
        "The user can monitor their own wellbeing and adjust the plan as circumstances change.",
      ],
      confidence: 35,
      uncertainties: [
        `The emotional and relationship impact of ${option.label.toLowerCase()} is personal and cannot be measured from the decision prompt alone: ${decision.question}`,
      ],
      projections: {
        year1: `Wellbeing check-in: notice changes in stress, connection, and daily satisfaction while adapting to ${option.label.toLowerCase()}.`,
        year5: `Wellbeing check-in: revisit whether ${option.label.toLowerCase()} still supports meaningful relationships, health, and personal priorities.`,
        year10: "Wellbeing check-in: treat fulfillment as something that can change over time rather than a fixed outcome of this choice.",
      },
      scores: {
        emotionalWellbeing: {
          value: 50,
          rationale: "Neutral baseline only: no validated wellbeing measure or personal baseline was supplied.",
        },
      },
      status: "complete",
    };
  }
}

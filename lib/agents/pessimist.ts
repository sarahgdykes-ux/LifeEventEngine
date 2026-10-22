import type { DecisionInput, DecisionOption } from "@/lib/schemas/decision";
import type { AgentResult } from "@/lib/schemas/simulation";
import type { SpecialistAgent } from "@/lib/agents/types";

export class PessimistAgent implements SpecialistAgent {
  readonly name = "pessimist" as const;

  async analyze(decision: DecisionInput, option: DecisionOption): Promise<AgentResult> {
    return {
      agent: this.name,
      optionId: option.id,
      findings: [
        `Illustrative downside: ${option.label} may create setbacks if important assumptions do not hold. Review the constraints and build a fallback plan.`,
      ],
      assumptions: [
        `This risk-focused scenario assumes that unexpected obstacles can make ${option.label.toLowerCase()} harder to sustain.`,
      ],
      confidence: 50,
      uncertainties: [
        `The likelihood and impact of specific failure modes cannot be estimated from the information provided about: ${decision.question}`,
      ],
      projections: {
        year1: `Illustrative risk check: identify early warning signs, likely obstacles, and a practical fallback while exploring ${option.label.toLowerCase()}.`,
        year5: `Illustrative risk check: reassess whether emerging responsibilities or setbacks are making ${option.label.toLowerCase()} less sustainable.`,
        year10: `Illustrative risk check: keep alternative paths open because long-term external conditions and personal circumstances may change.`,
      },
      scores: {
        riskLevel: {
          value: 50,
          rationale: "Neutral baseline only: the prompt does not provide enough evidence to estimate downside likelihood or severity.",
        },
      },
      status: "complete",
    };
  }
}

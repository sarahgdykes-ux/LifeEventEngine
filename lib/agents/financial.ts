import type { DecisionInput, DecisionOption } from "@/lib/schemas/decision";
import type { AgentResult } from "@/lib/schemas/simulation";
import type { SpecialistAgent } from "@/lib/agents/types";

export class FinancialAgent implements SpecialistAgent {
  readonly name = "financial" as const;

  async analyze(decision: DecisionInput, option: DecisionOption): Promise<AgentResult> {
    return {
      agent: this.name,
      optionId: option.id,
      findings: [
        `Financial review prompt: compare expected income, one-time costs, recurring expenses, debt, and savings for ${option.label.toLowerCase()}.`,
      ],
      assumptions: [
        "No income, expense, debt, savings, or location-specific cost data was supplied, so this is not a fiscal projection.",
      ],
      confidence: 25,
      uncertainties: [
        `The financial effect of ${option.label.toLowerCase()} depends on actual costs, income changes, and the user's available resources.`,
      ],
      projections: {
        year1: `Financial checkpoint: list transition costs and build a month-by-month budget for ${option.label.toLowerCase()} before committing.`,
        year5: `Financial checkpoint: review income growth, recurring costs, debt repayment, and savings against the original plan.`,
        year10: `Financial checkpoint: compare accumulated savings and obligations with alternatives; no long-range amount can be inferred from this prompt.`,
      },
      scores: {
        financialHealth: {
          value: 50,
          rationale: "Neutral baseline only: no personal financial figures were supplied to estimate cash flow, debt-to-income, or wealth changes.",
        },
      },
      status: "complete",
    };
  }
}

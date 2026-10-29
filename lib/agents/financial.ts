import type { DecisionInput, DecisionOption } from "@/lib/schemas/decision";
import type { AgentResult } from "@/lib/schemas/simulation";
import type { SpecialistAgent } from "@/lib/agents/types";
import { describeDecisionContext } from "@/lib/agents/context";

export class FinancialAgent implements SpecialistAgent {
  readonly name = "financial" as const;

  async analyze(decision: DecisionInput, option: DecisionOption): Promise<AgentResult> {
    const context = describeDecisionContext(decision, option);
    const hasConstraints = context.constraints !== "No specific constraints supplied";
    const hasConstraints = context.constraints !== "No specific constraints supplied";

    return {
      agent: this.name,
      optionId: option.id,
      findings: [
        `For "${context.question}", make a side-by-side budget for ${context.option} that includes income changes, one-time costs, recurring expenses, debt, and savings before judging its fit with ${context.goals}.`,
        hasConstraints
          ? `Check whether the budget protects the priority of ${context.priorities} while staying within the constraint(s): ${context.constraints}.`
          : `Check whether the budget protects the priority of ${context.priorities}.`,
      ],
      assumptions: [
        `No personal income, expense, debt, savings, or location-specific cost figures were supplied for ${context.option}; these prompts are illustrative and do not establish a financial outcome.`,
      ],
      confidence: 30,
      uncertainties: [
        hasConstraints
          ? `The financial effect of ${context.option} depends on actual costs, income changes, available resources, and any omitted costs associated with the stated constraints (${context.constraints}).`
          : `The financial effect of ${context.option} depends on actual costs, income changes, available resources, and any omitted costs.`,
        hasConstraints
          ? `The financial effect of ${context.option} depends on actual costs, income changes, available resources, and any omitted costs associated with the stated constraints (${context.constraints}).`
          : `The financial effect of ${context.option} depends on actual costs, income changes, available resources, and any omitted costs.`,
        `The prompt does not say what financial trade-offs the user would accept to pursue ${context.goals}.`,
      ],
      projections: {
        year1: hasConstraints
          ? `Illustrative checkpoint, not a forecast: list transition costs for ${context.option} and compare monthly income and expenses with the constraint(s) ${context.constraints}.`
          : `Illustrative checkpoint, not a forecast: list transition costs for ${context.option} and compare monthly income and expenses.`,
        year1: hasConstraints
          ? `Illustrative checkpoint, not a forecast: list transition costs for ${context.option} and compare monthly income and expenses with the constraint(s) ${context.constraints}.`
          : `Illustrative checkpoint, not a forecast: list transition costs for ${context.option} and compare monthly income and expenses.`,
        year5: `Illustrative checkpoint, not a forecast: compare actual income, recurring costs, debt, and savings with the budget and the goal of ${context.goals}.`,
        year10: `Illustrative checkpoint, not a forecast: reassess savings, obligations, and flexibility against the priority of ${context.priorities}; no future amount can be inferred here.`,
      },
      scores: {
        financialHealth: {
          value: 50,
          rationale: "Neutral placeholder only, not a forecast: no personal financial figures were supplied to estimate cash flow, affordability, or future wealth.",
        },
      },
      status: "complete",
    };
  }
}

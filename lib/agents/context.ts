import type { DecisionInput, DecisionOption } from "@/lib/schemas/decision";

export function describeDecisionContext(decision: DecisionInput, option: DecisionOption) {
  const constraints = Array.isArray(decision.constraints)
    ? decision.constraints
    : decision.constraints.other;

  return {
    question: decision.question,
    option: option.label,
    goals: decision.goals.join("; "),
    priorities: decision.priorities.join("; "),
    constraints: constraints.length > 0 ? constraints.join("; ") : "No specific constraints supplied",
  };
}

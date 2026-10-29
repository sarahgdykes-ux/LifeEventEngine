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
    baseline: decision.baselineState
      ? `Starting state assumptions (0-100): finances ${decision.baselineState.stats.finances}, wellbeing ${decision.baselineState.stats.wellbeing}, health ${decision.baselineState.stats.health}, career ${decision.baselineState.stats.career}; active commitments: ${decision.baselineState.commitments.join(", ") || "none listed"}.`
      : "No shared numeric baseline state was supplied.",
  };
}

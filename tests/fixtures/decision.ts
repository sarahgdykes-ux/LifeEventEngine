import type { DecisionInput } from "@/lib/schemas/decision";

export const sampleDecision: DecisionInput = {
  question: "Should I go to graduate school or move to a new city?",
  options: [
    { id: "A", label: "Go to graduate school" },
    { id: "B", label: "Move to a new city" },
  ],
  goals: ["Build a meaningful career", "Feel engaged in daily life"],
  priorities: ["Learning", "Community"],
  constraints: ["Keep costs manageable"],
};
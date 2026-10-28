import type { DecisionInput } from "@/lib/schemas/decision";

export const sampleDecision: DecisionInput = {
  question: "Should I go to graduate school or move to a new city?",
  options: [
    { id: "A", label: "Go to graduate school", description: "Pursue an advanced degree." },
    { id: "B", label: "Move to a new city", description: "Relocate for new opportunities." },
  ],
  goals: ["Build a meaningful career", "Feel engaged in daily life"],
  priorities: ["Learning", "Community"],
  constraints: { other: ["Keep costs manageable"] },
  baselineState: {
    character: { name: "Alex", age: 28, background: "Early-career professional" },
    year: 2026,
    stats: { finances: 65, wellbeing: 70, health: 80, career: 60 },
    commitments: ["Current_Job", "Apartment_Lease"],
  },
  scenarioEffects: [
    {
      optionId: "A",
      horizons: {
        year1: { finances: -6, wellbeing: -2, health: 0, career: 3 },
        year5: { finances: -10, wellbeing: -4, health: 0, career: 8 },
        year10: { finances: -12, wellbeing: -2, health: 0, career: 12 },
      },
      commitments: { new: ["Graduate_Program"], ended: [] },
    },
    {
      optionId: "B",
      horizons: {
        year1: { finances: -8, wellbeing: -6, health: -1, career: 10 },
        year5: { finances: 3, wellbeing: -3, health: -1, career: 14 },
        year10: { finances: 8, wellbeing: 2, health: 0, career: 16 },
      },
      commitments: { new: ["New_Role"], ended: ["Current_Job"] },
    },
  ],
};

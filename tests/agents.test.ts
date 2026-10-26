import { describe, expect, it } from "vitest";
import { FinancialAgent } from "@/lib/agents/financial";
import { PessimistAgent } from "@/lib/agents/pessimist";
import { WellbeingAgent } from "@/lib/agents/wellbeing";
import { AgentResultSchema } from "@/lib/schemas/simulation";
import { sampleDecision } from "@/tests/fixtures/decision";

describe("specialist agents", () => {
  it.each([
    ["pessimist", new PessimistAgent(), "riskLevel"],
    ["financial", new FinancialAgent(), "financialHealth"],
    ["wellbeing", new WellbeingAgent(), "emotionalWellbeing"],
  ] as const)("returns validated, context-specific results for both options (%s)", async (name, agent, scoreName) => {
    const constraints = Array.isArray(sampleDecision.constraints)
      ? sampleDecision.constraints[0]
      : sampleDecision.constraints.other[0];

    for (const option of sampleDecision.options) {
      const result = await agent.analyze(sampleDecision, option);

      expect(AgentResultSchema.parse(result)).toEqual(result);
      expect(result.agent).toBe(name);
      expect(result.optionId).toBe(option.id);
      expect(result.findings.join(" ")).toContain(sampleDecision.question);
      expect(result.findings.join(" ")).toContain(option.description);
      expect(result.findings.join(" ")).toContain(sampleDecision.goals[0]);
      expect(result.findings.join(" ")).toContain(sampleDecision.priorities[0]);
      expect(result.findings.join(" ")).toContain(constraints);
      expect(result.assumptions.join(" ")).toMatch(/illustrative|scenario/i);
      expect(result.uncertainties.length).toBeGreaterThan(0);
      expect(result.projections.year1).toMatch(/Illustrative/i);
      expect(result.projections.year5).toMatch(/Illustrative/i);
      expect(result.projections.year10).toMatch(/Illustrative/i);
      expect(result.status).toBe("complete");
      expect(result.scores[scoreName]).toBeDefined();
    }
  });

  it("rejects specialist output missing its required domain score", async () => {
    const result = await new FinancialAgent().analyze(sampleDecision, sampleDecision.options[0]);
    const invalidResult = { ...result, scores: {} };

    expect(AgentResultSchema.safeParse(invalidResult).success).toBe(false);
  });
});

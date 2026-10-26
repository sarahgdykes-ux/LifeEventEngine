import { describe, expect, it, vi } from "vitest";
import { Narrator } from "@/lib/narrator";
import { runSimulation } from "@/lib/orchestrator";
import type { AgentResult } from "@/lib/schemas/simulation";
import { SimulationSynthesisSchema } from "@/lib/schemas/simulation";
import { sampleDecision } from "@/tests/fixtures/decision";

describe("Narrator", () => {
  it("builds a schema-valid summary for both options from the complete validated result set", async () => {
    const report = await runSimulation(sampleDecision);
    const originalResults = structuredClone(report.results);
    const synthesis = new Narrator().synthesize(report.results, sampleDecision);

    expect(SimulationSynthesisSchema.safeParse(synthesis).success).toBe(true);
    expect(synthesis.decisionContext).toEqual({
      question: sampleDecision.question,
      goals: sampleDecision.goals,
      priorities: sampleDecision.priorities,
      constraints: ["Keep costs manageable"],
      options: sampleDecision.options.map(({ id, label, description }) => ({
        optionId: id,
        label,
        description,
      })),
    });
    expect(synthesis.options).toHaveLength(2);
    for (const option of synthesis.options) {
      expect(option.strongestFindings).toHaveLength(4);
      expect(option.tradeoffs.map(({ perspective }) => perspective).sort()).toEqual([
        "financial",
        "opportunity",
        "risk",
        "wellbeing",
      ]);
      expect(option.tradeoffs.find(({ perspective }) => perspective === "financial")?.decisionQuestion)
        .toContain(sampleDecision.priorities[0]);
      expect(option.timeline.year1).toHaveLength(4);
      expect(option.timeline.year5).toHaveLength(4);
      expect(option.timeline.year10).toHaveLength(4);
    }
    expect(report.results).toEqual(originalResults);
  });

  it("reports direct evidence-backed disagreement without forcing agreement", async () => {
    const report = await runSimulation(sampleDecision);
    const results = report.results.map((result) => {
      if (result.agent === "optimist" && result.optionId === "A") {
        return { ...result, findings: ["Option A improves financial stability."] };
      }
      if (result.agent === "financial" && result.optionId === "A") {
        return { ...result, findings: ["Option A does not improve financial stability."] };
      }
      return result;
    });

    const synthesis = new Narrator().synthesize(results, sampleDecision);
    const optionA = synthesis.options.find(({ optionId }) => optionId === "A");

    expect(optionA?.agreements).toEqual([]);
    expect(optionA?.disagreements).toEqual([{
      evidence: [
        { agent: "optimist", finding: "Option A improves financial stability." },
        { agent: "financial", finding: "Option A does not improve financial stability." },
      ],
    }]);
  });

  it("reports shared findings only when multiple agents state the same finding", async () => {
    const report = await runSimulation(sampleDecision);
    const sharedFinding = "The plan needs deliberate preparation.";
    const results = report.results.map((result) =>
      (result.agent === "optimist" || result.agent === "financial") && result.optionId === "A"
        ? { ...result, findings: [sharedFinding, ...result.findings.slice(1)] }
        : result,
    );

    const synthesis = new Narrator().synthesize(results, sampleDecision);
    const optionA = synthesis.options.find(({ optionId }) => optionId === "A");

    expect(optionA?.agreements).toContainEqual({
      finding: sharedFinding,
      agents: ["optimist", "financial"],
    });
  });

  it("refuses to synthesize when an expected result is missing", async () => {
    const report = await runSimulation(sampleDecision);

    expect(() => new Narrator().synthesize(report.results.slice(1), sampleDecision))
      .toThrow("Narrator requires one valid result from every specialist for both options");
  });

  it("rejects malformed agent output rather than building a summary", async () => {
    const report = await runSimulation(sampleDecision);
    const invalidResults = report.results.map((result, index) =>
      index === 0 ? { ...result, confidence: 101 } as AgentResult : result,
    );

    expect(() => new Narrator().synthesize(invalidResults, sampleDecision)).toThrow();
  });

  it("does not turn a Narrator exception into a complete report", async () => {
    const report = await runSimulation(sampleDecision);
    const narrator = new Narrator();
    const failure = vi.spyOn(narrator, "synthesize").mockImplementation(() => {
      throw new Error("private narrator failure");
    });

    await expect(runSimulation(sampleDecision, undefined, narrator))
      .rejects.toThrow("private narrator failure");
    expect(failure).toHaveBeenCalledOnce();
  });
});

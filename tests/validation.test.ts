import { describe, expect, it } from "vitest";
import { sampleDecision } from "@/tests/fixtures/decision";
import { validateAgentResults, validateDecisionInput, validateSimulationReport } from "@/lib/validation";

const validResult = {
  agent: "optimist",
  optionId: "A",
  findings: ["Illustrative finding"],
  assumptions: ["Illustrative assumption"],
  confidence: 55,
  uncertainties: ["Illustrative uncertainty"],
  projections: { year1: "First horizon", year5: "Second horizon", year10: "Third horizon" },
  status: "complete",
};

describe("shared runtime validation", () => {
  it("accepts a valid decision", () => {
    expect(validateDecisionInput(sampleDecision)).toEqual({ success: true, data: sampleDecision });
  });

  it("rejects empty required text and duplicate option IDs", () => {
    const emptyQuestion = validateDecisionInput({ ...sampleDecision, question: "  " });
    const duplicateOptions = validateDecisionInput({
      ...sampleDecision,
      options: [sampleDecision.options[0], { ...sampleDecision.options[1], id: "A" }],
    });

    expect(emptyQuestion.success).toBe(false);
    expect(duplicateOptions.success).toBe(false);
  });

  it("rejects malformed agent output and invalid enum/range values", () => {
    expect(() => validateAgentResults([{ ...validResult, agent: "narrator" }])).toThrow();
    expect(() => validateAgentResults([{ ...validResult, confidence: 101 }])).toThrow();
    expect(() => validateAgentResults([{ ...validResult, status: "unknown" }])).toThrow();
    expect(() => validateAgentResults([{ ...validResult, projections: { ...validResult.projections, year5: " " } }])).toThrow();
  });

  it("rejects duplicate agent-option results", () => {
    expect(() => validateAgentResults([validResult, validResult])).toThrow(/Duplicate agent-option result/);
  });

  it("rejects reports that omit an expected missing-result key", () => {
    expect(() => validateSimulationReport({
      decisionId: "decision-1",
      results: [validResult],
      reportStatus: "partial",
      missingResults: [],
    })).toThrow(/missingResults must list every absent agent-option result/);
  });
});
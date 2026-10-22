import { describe, expect, it } from "vitest";
import { runSimulation } from "@/lib/orchestrator";
import { sampleDecision } from "@/tests/fixtures/decision";

describe("runSimulation", () => {
  it("returns two Optimist results and marks the report partial", async () => {
    const report = await runSimulation(sampleDecision);

    expect(report.decisionId).toBeTruthy();
    expect(report.reportStatus).toBe("partial");
    expect(report.results).toHaveLength(2);
    expect(report.results.map(({ agent, optionId }) => `${agent}:${optionId}`)).toEqual([
      "optimist:A",
      "optimist:B",
    ]);
    expect(report.missingResults).toEqual([
      "pessimist:A",
      "pessimist:B",
      "financial:A",
      "financial:B",
      "wellbeing:A",
      "wellbeing:B",
    ]);
  });
});
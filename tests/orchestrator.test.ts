import { describe, expect, it, vi } from "vitest";
import { OptimistAgent } from "@/lib/agents/optimist";
import type { SpecialistAgent } from "@/lib/agents/types";
import { runSimulation } from "@/lib/orchestrator";
import type { AgentResult } from "@/lib/schemas/simulation";
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
    expect(report.results.map(({ optionId }) => optionId)).toEqual(["A", "B"]);
    expect(report.results.every(({ agent }) => agent === "optimist")).toBe(true);
    expect(report.results.map(({ agent }) => String(agent))).not.toContain("narrator");
  });

  it("retains a usable result when the other option fails", async () => {
    const optimisticAgent = new OptimistAgent();
    const agent: SpecialistAgent = {
      name: "optimist",
      analyze: vi.fn(async (decision, option) => {
        if (option.id === "A") throw new Error("private decision detail");
        return optimisticAgent.analyze(decision, option);
      }),
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const report = await runSimulation(sampleDecision, agent);

    expect(report.results.map(({ optionId }) => optionId)).toEqual(["B"]);
    expect(report.missingResults).toContain("optimist:A");
    expect(log).toHaveBeenCalledWith("Simulation agent result rejected", {
      key: "optimist:A",
      failureType: "agent_error",
    });
    log.mockRestore();
  });

  it("omits invalid mock output and fails if neither option is usable", async () => {
    const optimisticAgent = new OptimistAgent();
    const invalidAgent: SpecialistAgent = {
      name: "optimist",
      analyze: vi.fn(async (decision, option) => {
        const result = await optimisticAgent.analyze(decision, option);
        return option.id === "A" ? { ...result, confidence: 101 } as AgentResult : result;
      }),
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const partialReport = await runSimulation(sampleDecision, invalidAgent);
    expect(partialReport.results.map(({ optionId }) => optionId)).toEqual(["B"]);
    expect(partialReport.missingResults).toContain("optimist:A");
    await expect(runSimulation(sampleDecision, {
      name: "optimist",
      analyze: vi.fn().mockRejectedValue(new Error("private decision detail")),
    })).rejects.toThrow("No usable simulation results");

    log.mockRestore();
  });
});
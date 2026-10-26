import { describe, expect, it, vi } from "vitest";
import type { SpecialistAgent } from "@/lib/agents/types";
import { SPECIALIST_AGENTS, runSimulation } from "@/lib/orchestrator";
import { narrator } from "@/lib/narrator";
import type { AgentResult } from "@/lib/schemas/simulation";
import { sampleDecision } from "@/tests/fixtures/decision";

describe("runSimulation", () => {
  it("runs all four agents for both options and returns a synthesized complete report", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const report = await runSimulation(sampleDecision);

    expect(report.decisionId).toBeTruthy();
    expect(report.reportStatus).toBe("complete");
    expect(report.results).toHaveLength(8);
    expect(report.results.map(({ agent, optionId }) => `${agent}:${optionId}`).sort()).toEqual([
      "financial:A",
      "financial:B",
      "optimist:A",
      "optimist:B",
      "pessimist:A",
      "pessimist:B",
      "wellbeing:A",
      "wellbeing:B",
    ]);
    expect(report.missingResults).toEqual([]);
    expect(report.synthesis.options.map(({ optionId }) => optionId)).toEqual(["A", "B"]);
    expect(report.synthesis.options[0].timeline.year1).toHaveLength(4);
    expect(report.synthesis.options[0].breakdownScores).toEqual({
      financialHealth: expect.objectContaining({ value: 50 }),
      emotionalWellbeing: expect.objectContaining({ value: 50 }),
      riskLevel: expect.objectContaining({ value: 50 }),
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(sampleDecision.question);
    expect(JSON.stringify(log.mock.calls)).not.toContain(sampleDecision.options[0].label);
    expect(SPECIALIST_AGENTS).toHaveLength(4);
    expect(log).toHaveBeenCalledWith("Simulation narrator handoff started", { validatedResultCount: 8 });
    log.mockRestore();
  });

  it("dispatches all agent-option calls concurrently", async () => {
    const analyze = vi.fn();
    const agents: SpecialistAgent[] = SPECIALIST_AGENTS.map((agent) => ({
      ...agent,
      analyze: async (decision, option) => {
        analyze(agent.name, option.id);
        return agent.analyze(decision, option);
      },
    }));
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await runSimulation(sampleDecision, agents);

    expect(analyze).toHaveBeenCalledTimes(8);
    log.mockRestore();
  });

  it("does not invoke the narrator when any worker fails schema validation", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const customAgents = SPECIALIST_AGENTS.map((agent) => ({
      ...agent,
      analyze: vi.fn(async (decision, option) => {
        const result = await agent.analyze(decision, option);
        return agent.name === "financial" && option.id === "A"
          ? { ...result, scores: {} } as AgentResult
          : result;
      }),
    }));
    const narrate = vi.spyOn(narrator, "synthesize");

    await expect(runSimulation(sampleDecision, customAgents)).rejects.toThrow(
      "Simulation aborted because one or more specialist results failed validation or analysis",
    );
    expect(narrate).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("Simulation agent result rejected", {
      key: "financial:A",
      failureType: "invalid_output",
      schemaValid: false,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(sampleDecision.question);
    narrate.mockRestore();
    log.mockRestore();
  });

  it("aborts and logs when a specialist throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const customAgents = SPECIALIST_AGENTS.map((agent) => ({
      ...agent,
      analyze: vi.fn(async (decision, option) => {
        if (agent.name === "pessimist" && option.id === "A") {
          throw new Error("analysis failed");
        }
        return agent.analyze(decision, option);
      }),
    }));
    const narrate = vi.spyOn(narrator, "synthesize");

    await expect(runSimulation(sampleDecision, customAgents)).rejects.toThrow(
      "Simulation aborted because one or more specialist results failed validation or analysis",
    );
    expect(narrate).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("Simulation agent result rejected", {
      key: "pessimist:A",
      failureType: "agent_error",
      schemaValid: false,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("analysis failed");
    narrate.mockRestore();
    log.mockRestore();
  });

  it("rejects incomplete or duplicate specialist registries", async () => {
    await expect(runSimulation(sampleDecision, SPECIALIST_AGENTS.slice(0, 3))).rejects.toThrow(
      "Simulation requires exactly one implementation of each specialist",
    );
    await expect(runSimulation(sampleDecision, [...SPECIALIST_AGENTS, SPECIALIST_AGENTS[0]])).rejects.toThrow(
      "Simulation requires exactly one implementation of each specialist",
    );
  });
});

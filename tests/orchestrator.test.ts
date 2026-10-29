import { describe, expect, it, vi } from "vitest";
import type { SpecialistAgent } from "@/lib/agents/types";
import { SPECIALIST_AGENTS, runSimulation } from "@/lib/orchestrator";
import { narrator, type Narrator } from "@/lib/narrator";
import type { AgentResult } from "@/lib/schemas/simulation";
import { SimulationReportSchema } from "@/lib/schemas/simulation";
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
    expect(report.results.every((result) => result.status === "complete")).toBe(true);
    expect(SimulationReportSchema.safeParse(report).success).toBe(true);
    expect(report.missingResults).toEqual([]);
    if (!report.synthesis) throw new Error("Expected complete report synthesis");
    expect(report.synthesis.options.map(({ optionId }) => optionId)).toEqual(["A", "B"]);
    expect(report.synthesis.options[0].timeline.year1).toHaveLength(4);
    expect(report.synthesis.options[0].breakdownScores).toEqual({
      financialHealth: expect.objectContaining({ value: 53 }),
      emotionalWellbeing: expect.objectContaining({ value: 68 }),
      riskLevel: expect.objectContaining({ value: 4 }),
    });
    expect(report.stateProjection?.options.map(({ optionId }) => optionId)).toEqual(["A", "B"]);
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

  it("records specialist retry metadata in the matching audit handoff", async () => {
    const agents: SpecialistAgent[] = SPECIALIST_AGENTS.map((agent) => ({
      ...agent,
      analyzeWithMetadata: async (decision, option) => ({
        result: await agent.analyze(decision, option),
        retriesUsed: agent.name === "optimist" && option.id === "A" ? 2 : 0,
      }),
    }));

    const report = await runSimulation(sampleDecision, agents);

    expect(report.auditLog?.find(({ key }) => key === "optimist:A")?.retriesUsed).toBe(2);
    expect(report.auditLog?.find(({ key }) => key === "optimist:B")?.retriesUsed).toBe(0);
    expect(SimulationReportSchema.safeParse(report).success).toBe(true);
  });

  it("returns a partial report when an agent returns no output", async () => {
    const customAgents = SPECIALIST_AGENTS.map((agent) => ({
      ...agent,
      analyze: vi.fn(async (decision, option) => {
        if (agent.name === "financial" && option.id === "A") return undefined as unknown as AgentResult;
        return agent.analyze(decision, option);
      }),
    }));
    const narrate = vi.spyOn(narrator, "synthesize");

    const report = await runSimulation(sampleDecision, customAgents);

    expect(report.reportStatus).toBe("partial");
    expect(report.missingResults).toEqual(["financial:A"]);
    expect(report.results).toHaveLength(7);
    expect(report.results.map(({ agent, optionId }) => `${agent}:${optionId}`)).not.toContain("financial:A");
    expect(report.results.some(({ agent, optionId }) => agent === "financial" && optionId === "B")).toBe(true);
    expect(report.synthesis).toBeNull();
    expect(SimulationReportSchema.safeParse(report).success).toBe(true);
    expect(narrate).not.toHaveBeenCalled();
    narrate.mockRestore();
  });

  it("never returns a complete report when the Narrator returns invalid output", async () => {
    const invalidNarrator: Narrator = {
      synthesize: () => null as never,
    };

    await expect(runSimulation(sampleDecision, SPECIALIST_AGENTS, invalidNarrator))
      .rejects.toThrow();
  });

  it("rejects duplicate agent-option outputs and marks the affected keys missing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const agents = [
      ...SPECIALIST_AGENTS.filter(({ name }) => name !== "financial"),
      SPECIALIST_AGENTS.find(({ name }) => name === "optimist")!,
    ];

    const report = await runSimulation(sampleDecision, agents);

    expect(report.reportStatus).toBe("partial");
    expect(report.results).toHaveLength(4);
    expect(report.results.map(({ agent, optionId }) => `${agent}:${optionId}`).sort()).toEqual([
      "pessimist:A",
      "pessimist:B",
      "wellbeing:A",
      "wellbeing:B",
    ]);
    expect(report.missingResults).toEqual([
      "optimist:A",
      "optimist:B",
      "financial:A",
      "financial:B",
    ]);
    expect(report.synthesis).toBeNull();
    expect(log).toHaveBeenCalledWith("Simulation duplicate agent results rejected", {
      key: "optimist:A",
      duplicateCount: 2,
    });
    expect(SimulationReportSchema.safeParse(report).success).toBe(true);
    log.mockRestore();
  });

  it("does not let a mismatched result invalidate the requested specialist's valid result", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const pessimist = SPECIALIST_AGENTS.find(({ name }) => name === "pessimist");
    if (!pessimist) throw new Error("Expected a registered Pessimist agent");
    const customAgents = SPECIALIST_AGENTS.map((agent) => ({
      ...agent,
      analyze: vi.fn(async (decision, option) => {
        return agent.name === "optimist" && option.id === "A"
          ? pessimist.analyze(decision, option)
          : agent.analyze(decision, option);
      }),
    }));

    const report = await runSimulation(sampleDecision, customAgents);

    expect(report.reportStatus).toBe("partial");
    expect(report.missingResults).toEqual(["optimist:A"]);
    expect(report.results.some(({ agent, optionId }) => agent === "pessimist" && optionId === "A")).toBe(true);
    expect(report.results).toHaveLength(7);
    expect(log).toHaveBeenCalledWith("Simulation agent result rejected", {
      key: "optimist:A",
      failureType: "key_mismatch",
      schemaValid: true,
    });
    expect(SimulationReportSchema.safeParse(report).success).toBe(true);
    log.mockRestore();
  });

  it("returns a partial report when an agent returns invalid output", async () => {
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

    const report = await runSimulation(sampleDecision, customAgents);

    expect(report.reportStatus).toBe("partial");
    expect(report.missingResults).toEqual(["financial:A"]);
    expect(report.results).toHaveLength(7);
    expect(report.results.some(({ agent, optionId }) => agent === "financial" && optionId === "B")).toBe(true);
    expect(report.synthesis).toBeNull();
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

  it("returns a partial report and logs safely when a specialist throws", async () => {
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

    const report = await runSimulation(sampleDecision, customAgents);

    expect(report.reportStatus).toBe("partial");
    expect(report.missingResults).toEqual(["pessimist:A"]);
    expect(report.results).toHaveLength(7);
    expect(report.results.some(({ agent, optionId }) => agent === "pessimist" && optionId === "B")).toBe(true);
    expect(report.synthesis).toBeNull();
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

  it("returns a partial report when successes and failures are mixed", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const customAgents = SPECIALIST_AGENTS.map((agent) => ({
      ...agent,
      analyze: vi.fn(async (decision, option) => {
        if (agent.name === "financial" && option.id === "A") return undefined as unknown as AgentResult;
        if (agent.name === "wellbeing" && option.id === "B") throw new Error("private worker detail");
        return agent.analyze(decision, option);
      }),
    }));

    const report = await runSimulation(sampleDecision, customAgents);

    expect(report.reportStatus).toBe("partial");
    expect(report.missingResults).toEqual(["financial:A", "wellbeing:B"]);
    expect(report.results).toHaveLength(6);
    expect(report.results.map(({ agent, optionId }) => `${agent}:${optionId}`).sort()).toEqual([
      "financial:B",
      "optimist:A",
      "optimist:B",
      "pessimist:A",
      "pessimist:B",
      "wellbeing:A",
    ]);
    expect(report.synthesis).toBeNull();
    expect(JSON.stringify(log.mock.calls)).not.toContain("private worker detail");
    expect(SimulationReportSchema.safeParse(report).success).toBe(true);
    log.mockRestore();
  });
});

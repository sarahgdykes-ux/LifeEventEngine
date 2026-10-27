import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/simulate/route";
import * as orchestrator from "@/lib/orchestrator";
import { Narrator } from "@/lib/narrator";
import { SimulationReportSchema } from "@/lib/schemas/simulation";
import { sampleDecision } from "@/tests/fixtures/decision";

describe("POST /api/simulate", () => {
  it("returns a typed complete report for a valid decision", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleDecision),
    }));
    const report = await response.json();

    expect(response.status).toBe(200);
    expect(SimulationReportSchema.safeParse(report).success).toBe(true);
    expect(report.reportStatus).toBe("complete");
    expect(report.results).toHaveLength(8);
    expect(report.synthesis.options).toHaveLength(2);
    expect(report.missingResults).toEqual([]);
    log.mockRestore();
  });

  it("preserves changed goals, constraints, and distinct option context in the report", async () => {
    const decision = {
      ...sampleDecision,
      options: [
        { ...sampleDecision.options[0], description: "Requires evening study and tuition planning." },
        { ...sampleDecision.options[1], description: "Requires a relocation plan and a new support network." },
      ],
      goals: ["finish a degree", "build a local community"],
      priorities: ["manageable costs", "time with family"],
      constraints: { other: ["limited savings", "caregiving schedule"] },
    };
    const response = await POST(new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(decision),
    }));
    const report = await response.json();

    expect(response.status).toBe(200);
    expect(report.reportStatus).toBe("complete");
    expect(report.synthesis.decisionContext).toEqual({
      question: decision.question,
      goals: decision.goals,
      priorities: decision.priorities,
      constraints: decision.constraints.other,
      options: decision.options.map(({ id, label, description }) => ({
        optionId: id,
        label,
        description,
      })),
    });
    const financialFindings = report.results.find((result: { agent: string; optionId: string }) =>
      result.agent === "financial" && result.optionId === "A",
    ).findings.join(" ");
    expect(financialFindings).toContain("limited savings");
    expect(financialFindings).toContain("caregiving schedule");
    expect(report.results.find((result: { agent: string; optionId: string }) =>
      result.agent === "wellbeing" && result.optionId === "B",
    ).findings.join(" ")).toContain("new support network");
  });

  it("runs both options through the state projection pipeline with clamping and state-derived scores", async () => {
    const decision = {
      ...sampleDecision,
      baselineState: {
        ...sampleDecision.baselineState!,
        stats: { ...sampleDecision.baselineState!.stats, finances: 95 },
      },
      scenarioEffects: sampleDecision.scenarioEffects!.map((scenario) => ({
        ...scenario,
        horizons: {
          year1: { ...scenario.horizons.year1, finances: scenario.optionId === "A" ? 20 : -20 },
          year5: { ...scenario.horizons.year5, finances: scenario.optionId === "A" ? 20 : -20 },
          year10: { ...scenario.horizons.year10, finances: scenario.optionId === "A" ? 20 : -20 },
        },
      })),
    };
    const response = await POST(new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(decision),
    }));
    const report = await response.json();

    expect(response.status).toBe(200);
    expect(SimulationReportSchema.safeParse(report).success).toBe(true);
    const optionA = report.stateProjection.options.find((option: { optionId: string }) => option.optionId === "A");
    const optionB = report.stateProjection.options.find((option: { optionId: string }) => option.optionId === "B");
    expect(optionA.horizons.year1.state.stats.finances).toBe(100);
    expect(optionB.horizons.year1.state.stats.finances).toBe(75);
    expect(optionA.horizons.year10.state.year).toBe(2036);
    expect(optionA.horizons.year10.event.mutation_tag).toBe("BASELINE_PRESERVING_OPTION");
    expect(report.synthesis.options.find((option: { optionId: string }) => option.optionId === "A").breakdownScores.financialHealth.value).toBe(100);
    expect(report.synthesis.options.find((option: { optionId: string }) => option.optionId === "B").breakdownScores.financialHealth.value).toBe(75);
  });

  it("retries a health death-spiral assumption with a safe unchanged-state projection and audit flag", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const decision = {
      ...sampleDecision,
      baselineState: {
        ...sampleDecision.baselineState!,
        stats: { ...sampleDecision.baselineState!.stats, health: 20 },
      },
      scenarioEffects: sampleDecision.scenarioEffects!.map((scenario) => scenario.optionId === "A"
        ? {
            ...scenario,
            horizons: {
              year1: { ...scenario.horizons.year1, health: -20 },
              year5: { ...scenario.horizons.year5, health: -20 },
              year10: { ...scenario.horizons.year10, health: -20 },
            },
          }
        : scenario),
    };
    const response = await POST(new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(decision),
    }));
    const report = await response.json();
    const optionA = report.stateProjection.options.find((option: { optionId: string }) => option.optionId === "A");

    expect(response.status).toBe(200);
    expect(optionA.horizons.year10.state.stats.health).toBe(20);
    expect(optionA.horizons.year10.correctionReasons.join(" ")).toContain("Health reaches 0");
    expect(optionA.trajectoryReview.status).toBe("at_risk");
    expect(optionA.trajectoryReview.flags.join(" ")).toContain("Rejected proposed projection");
    expect(report.auditLog.some((entry: { key: string; detail: string }) =>
      entry.key === "event:A:year10" && entry.detail.includes("safe unchanged-state retry"),
    )).toBe(true);
    log.mockRestore();
  });

  it("returns an explicit failed report when no specialist result is complete", async () => {
    const missingResults = [
      "optimist:A",
      "optimist:B",
      "pessimist:A",
      "pessimist:B",
      "financial:A",
      "financial:B",
      "wellbeing:A",
      "wellbeing:B",
    ];
    const simulation = vi.spyOn(orchestrator, "runSimulation").mockResolvedValueOnce({
      decisionId: "test-decision",
      results: [],
      synthesis: null,
      reportStatus: "failed",
      missingResults,
    });

    const response = await POST(new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleDecision),
    }));
    const report = await response.json();

    expect(response.status).toBe(200);
    expect(SimulationReportSchema.safeParse(report).success).toBe(true);
    expect(report.reportStatus).toBe("failed");
    expect(report.synthesis).toBeNull();
    expect(report.missingResults).toEqual(missingResults);
    simulation.mockRestore();
  });

  it("does not return an invalid report from the orchestration boundary", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const simulation = vi.spyOn(orchestrator, "runSimulation").mockResolvedValueOnce({} as never);
    const response = await POST(new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleDecision),
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Simulation could not be completed." },
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(sampleDecision.question);
    simulation.mockRestore();
    log.mockRestore();
  });

  it.each([
    ["missing question", { ...sampleDecision, question: "" }],
    ["missing option", { ...sampleDecision, options: [sampleDecision.options[0]] }],
    ["invalid option ID", { ...sampleDecision, options: [{ ...sampleDecision.options[0], id: "C" }, sampleDecision.options[1]] }],
    ["malformed fields", { ...sampleDecision, goals: [" "] }],
  ])("returns a typed 400 for %s", async (_name, input) => {
    const response = await POST(new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "INVALID_REQUEST", message: "Request body does not match DecisionInput." },
    });
  });

  it("returns a typed 400 for malformed JSON", async () => {
    const malformedJsonResponse = await POST(new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{invalid",
    }));

    expect(malformedJsonResponse.status).toBe(400);
    expect(await malformedJsonResponse.json()).toEqual({
      error: { code: "INVALID_REQUEST", message: "Request body must be valid JSON." },
    });
  });

  it("rejects request bodies larger than the server limit before parsing", async () => {
    const response = await POST(new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: " ".repeat(32 * 1024 + 1),
    }));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: { code: "INVALID_REQUEST", message: "Request body exceeds the 32 KB limit." },
    });
  });

  it("returns a safe 500 when simulation execution fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = vi.spyOn(orchestrator, "runSimulation").mockRejectedValueOnce(new Error("private detail"));
    const response = await POST(new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleDecision),
    }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Simulation could not be completed." },
    });
    expect(JSON.stringify(body)).not.toContain("private detail");
    expect(JSON.stringify(log.mock.calls)).not.toContain("private detail");
    failure.mockRestore();
    log.mockRestore();
  });

  it("returns a safe server error when Narrator synthesis throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const narrator = new Narrator();
    vi.spyOn(narrator, "synthesize").mockImplementation(() => {
      throw new Error("private narrator stack detail");
    });
    const originalRunSimulation = orchestrator.runSimulation;
    const simulation = vi.spyOn(orchestrator, "runSimulation").mockImplementation(
      (decision) => originalRunSimulation(decision, orchestrator.SPECIALIST_AGENTS, narrator),
    );

    const response = await POST(new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleDecision),
    }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Simulation could not be completed." },
    });
    expect(JSON.stringify(body)).not.toContain("private narrator stack detail");
    expect(JSON.stringify(log.mock.calls)).not.toContain("private narrator stack detail");
    simulation.mockRestore();
    log.mockRestore();
  });
});

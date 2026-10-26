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
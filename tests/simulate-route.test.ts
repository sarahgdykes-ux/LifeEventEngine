import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/simulate/route";
import * as orchestrator from "@/lib/orchestrator";
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

  it("returns a safe 500 when simulation execution fails", async () => {
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
    failure.mockRestore();
  });
});
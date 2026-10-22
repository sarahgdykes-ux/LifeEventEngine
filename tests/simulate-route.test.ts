import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/simulate/route";
import * as orchestrator from "@/lib/orchestrator";
import { sampleDecision } from "@/tests/fixtures/decision";

describe("POST /api/simulate", () => {
  it("returns a typed partial report for a valid decision", async () => {
    const response = await POST(new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleDecision),
    }));
    const report = await response.json();

    expect(response.status).toBe(200);
    expect(report.reportStatus).toBe("partial");
    expect(report.results).toHaveLength(2);
  });

  it("returns 400 for invalid input and malformed JSON", async () => {
    const invalidDecisionResponse = await POST(new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...sampleDecision, options: [] }),
    }));
    const malformedJsonResponse = await POST(new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{invalid",
    }));

    expect(invalidDecisionResponse.status).toBe(400);
    expect(await invalidDecisionResponse.json()).toMatchObject({ error: "Invalid decision input" });
    expect(malformedJsonResponse.status).toBe(400);
    expect(await malformedJsonResponse.json()).toMatchObject({ error: "Request body must be valid JSON" });
  });

  it("returns a safe 500 when simulation execution fails", async () => {
    const failure = vi.spyOn(orchestrator, "runSimulation").mockRejectedValueOnce(new Error("private detail"));
    const response = await POST(new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleDecision),
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Simulation could not be completed" });
    failure.mockRestore();
  });
});
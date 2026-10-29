// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTimelineExportData,
  downloadJSONReport,
  generateMarkdownReport,
} from "@/lib/export";
import { runSimulation } from "@/lib/orchestrator";
import { sampleDecision } from "@/tests/fixtures/decision";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("simulation report exports", () => {
  it("builds export data with decision, projections, stat deltas, and retry metadata", async () => {
    const report = await runSimulation(sampleDecision);
    report.auditLog = report.auditLog?.map((entry) => entry.key === "optimist:A"
      ? { ...entry, retriesUsed: 2 }
      : entry);

    const data = createTimelineExportData(sampleDecision, report, "2026-10-28T12:00:00.000Z");

    expect(data.simulationId).toBe(report.decisionId);
    expect(data.horizonYears).toEqual([1, 5, 10]);
    expect(data.statDeltas.A.year1).toEqual({ finances: -6, wellbeing: -2, health: 0, career: 3 });
    expect(data.agentSummaries.find(({ agentId, optionId }) => agentId === "optimist" && optionId === "A")?.retriesUsed).toBe(2);
    expect(data.report).toEqual(report);
  });

  it("formats a readable Markdown report with comparative scores and agent horizons", async () => {
    const report = await runSimulation(sampleDecision);
    const data = createTimelineExportData(sampleDecision, report, "2026-10-28T12:00:00.000Z");

    const markdown = generateMarkdownReport(data);

    expect(markdown).toContain("# Life Decision Simulator Report");
    expect(markdown).toContain("## Option A: Go to graduate school");
    expect(markdown).toContain("- Financial health: 53/100");
    expect(markdown).toContain("Year 1: finances: -6, wellbeing: -2, health: 0, career: +3");
    expect(markdown).toContain("### OPTIMIST · Option A (Retries: 0)");
    expect(markdown).toContain("- Year 10:");
    expect(markdown).toContain("not predictions or professional advice");
  });

  it("downloads the export data as a JSON file", async () => {
    const report = await runSimulation(sampleDecision);
    const data = createTimelineExportData(sampleDecision, report, "2026-10-28T12:00:00.000Z");
    const createObjectURL = vi.fn(() => "blob:simulation-report");
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    downloadJSONReport(data, "test-simulation.json");

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:simulation-report");
    expect(document.querySelector("a[download='test-simulation.json']")).toBeNull();
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import SimulationApp from "@/components/simulation-app";
import { AGENT_NAMES, OPTION_IDS } from "@/lib/agents/types";
import { Narrator } from "@/lib/narrator";
import { runSimulation } from "@/lib/orchestrator";
import { SimulationReportSchema, type SimulationReport } from "@/lib/schemas/simulation";
import { sampleDecision } from "@/tests/fixtures/decision";

let completeReport: SimulationReport;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fillDecisionForm() {
  fireEvent.change(screen.getByLabelText("Your question"), {
    target: { value: sampleDecision.question },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next →" }));
  fireEvent.change(screen.getByLabelText("Option A label"), {
    target: { value: sampleDecision.options[0].label },
  });
  fireEvent.change(screen.getByLabelText("Option A description"), {
    target: { value: sampleDecision.options[0].description },
  });
  fireEvent.change(screen.getByLabelText("Option B label"), {
    target: { value: sampleDecision.options[1].label },
  });
  fireEvent.change(screen.getByLabelText("Option B description"), {
    target: { value: sampleDecision.options[1].description },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next →" }));
  const lists = [
    [/^Goals/, sampleDecision.goals],
    [/^Priorities/, sampleDecision.priorities],
    [/^Other constraints/, Array.isArray(sampleDecision.constraints) ? sampleDecision.constraints : sampleDecision.constraints.other],
  ] as const;
  for (const [label, items] of lists) {
    const input = screen.getByLabelText(label);
    for (const item of items) {
      fireEvent.change(input, { target: { value: item } });
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    }
  }
  fireEvent.click(screen.getByRole("button", { name: "Next →" }));
  fireEvent.click(screen.getByRole("button", { name: "Next →" }));
}

function makePartialReport(): SimulationReport {
  const availableResult = completeReport.results.find(
    ({ agent, optionId }) => agent === "optimist" && optionId === "A",
  );
  if (!availableResult) throw new Error("Expected an Optimist result for option A");

  const availableKey = `${availableResult.agent}:${availableResult.optionId}`;
  return SimulationReportSchema.parse({
    ...completeReport,
    results: [availableResult],
    synthesis: null,
    reportStatus: "partial",
    missingResults: AGENT_NAMES.flatMap((agent) =>
      OPTION_IDS.map((optionId) => `${agent}:${optionId}`),
    ).filter((key) => key !== availableKey),
  });
}

function makeFailedReport(): SimulationReport {
  return SimulationReportSchema.parse({
    ...completeReport,
    results: [],
    synthesis: null,
    reportStatus: "failed",
    missingResults: AGENT_NAMES.flatMap((agent) =>
      OPTION_IDS.map((optionId) => `${agent}:${optionId}`),
    ),
  });
}

beforeAll(async () => {
  vi.stubEnv("LLM_PROVIDER", "mock");
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  completeReport = await runSimulation(sampleDecision);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("SimulationApp", () => {
  it("renders a validated Narrator comparison for a complete report", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(completeReport)));
    render(<SimulationApp />);
    fillDecisionForm();

    fireEvent.click(screen.getByRole("button", { name: /Explore this decision/ }));

    expect(await screen.findByText("Complete report")).toBeTruthy();
    expect(screen.getByText(/All eight specialist results passed validation/)).toBeTruthy();
    expect(screen.getAllByRole("heading", { name: "Optimist" })).toHaveLength(2);
    expect(screen.getAllByText("Key findings by perspective")).toHaveLength(2);
    expect(screen.getAllByText("Trade-offs to consider")).toHaveLength(2);
    expect(screen.getAllByText("Direct disagreements")).toHaveLength(2);
    expect(screen.getAllByText(/No direct contradiction was identified/)).toHaveLength(2);
    expect(screen.getAllByText(/Each excerpt is quoted from/)).toHaveLength(2);
    expect(screen.getAllByText("Illustrative projections · not predictions")).toHaveLength(8);
  });

  it("renders both sides of a source-backed disagreement", async () => {
    const disagreeingResults = completeReport.results.map((result) => {
      if (result.agent === "optimist" && result.optionId === "A") {
        return { ...result, findings: ["Option A improves financial stability."] };
      }
      if (result.agent === "financial" && result.optionId === "A") {
        return { ...result, findings: ["Option A does not improve financial stability."] };
      }
      return result;
    });
    const disagreeingReport = SimulationReportSchema.parse({
      ...completeReport,
      results: disagreeingResults,
      synthesis: new Narrator().synthesize(disagreeingResults, sampleDecision),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(disagreeingReport)));
    render(<SimulationApp />);
    fillDecisionForm();

    fireEvent.click(screen.getByRole("button", { name: /Explore this decision/ }));

    expect(await screen.findByText("Complete report")).toBeTruthy();
    expect(screen.getAllByText("Option A improves financial stability.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Option A does not improve financial stability.").length).toBeGreaterThan(0);
  });

  it("shows clean and recovered retry badges in the developer audit view", async () => {
    const retryReport = SimulationReportSchema.parse({
      ...completeReport,
      auditLog: completeReport.auditLog?.map((entry) => ({
        ...entry,
        ...(entry.key === "optimist:A" ? { retriesUsed: 2, source: "live_provider" as const } : {}),
        ...(entry.key === "optimist:B" ? { retriesUsed: 0, source: "deterministic_fallback" as const } : {}),
      })),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(retryReport)));
    render(<SimulationApp />);
    fillDecisionForm();

    fireEvent.click(screen.getByRole("button", { name: /Explore this decision/ }));
    expect(await screen.findByText("Complete report")).toBeTruthy();
    fireEvent.click(screen.getByText("Developer audit view"));

    expect(screen.getByText("2 retries required")).toBeTruthy();
    expect(screen.getByText("0 retries (clean)")).toBeTruthy();
    expect(screen.getByText("live_provider")).toBeTruthy();
    expect(screen.getByText("deterministic_fallback")).toBeTruthy();
  });

  it("copies a formatted Markdown report from the export controls", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(completeReport)));
    render(<SimulationApp />);
    fillDecisionForm();

    fireEvent.click(screen.getByRole("button", { name: /Explore this decision/ }));
    expect(await screen.findByText("Complete report")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy Markdown report" }));

    expect(await screen.findByText("Markdown report copied to clipboard.")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("# Life Decision Simulator Report"));
  });

  it("shows partial reports and identifies every missing result without filling gaps", async () => {
    const partialReport = makePartialReport();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(partialReport)));
    render(<SimulationApp />);
    fillDecisionForm();

    fireEvent.click(screen.getByRole("button", { name: /Explore this decision/ }));

    expect(await screen.findByText("Partial report")).toBeTruthy();
    expect(screen.getByText(/Some specialist results are missing or incomplete/)).toBeTruthy();
    const availableFinding = completeReport.results.find(
      ({ agent, optionId }) => agent === "optimist" && optionId === "A",
    )?.findings[0];
    if (!availableFinding) throw new Error("Expected an Optimist finding for option A");
    expect(screen.getByText(availableFinding)).toBeTruthy();
    expect(screen.getAllByText(/not returned ·/)).toHaveLength(7);
    expect(screen.getAllByText(/No validated result was returned/)).toHaveLength(7);
    expect(screen.queryByText("At-a-glance comparison")).toBeNull();
    expect(screen.getAllByText(sampleDecision.question).length).toBeGreaterThan(0);
  });

  it("renders a failed report with every unavailable result identified", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(makeFailedReport())));
    render(<SimulationApp />);
    fillDecisionForm();

    fireEvent.click(screen.getByRole("button", { name: /Explore this decision/ }));

    expect(await screen.findByText("Report failed")).toBeTruthy();
    expect(screen.getByText(/No specialist returned a complete result/)).toBeTruthy();
    expect(screen.getAllByText(/not returned ·/)).toHaveLength(8);
    expect(screen.getAllByText(/No validated result was returned/)).toHaveLength(8);
    expect(screen.queryByText("At-a-glance comparison")).toBeNull();
  });

  it("prevents repeat submissions while the first request is pending", async () => {
    let resolveResponse: (response: Response) => void = () => undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn(() => pendingResponse);
    vi.stubGlobal("fetch", fetchMock);
    render(<SimulationApp />);
    fillDecisionForm();

    fireEvent.click(screen.getByRole("button", { name: /Explore this decision/ }));
    const submitButton = screen.getByRole("button", { name: /Exploring both paths/ }) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
    expect(screen.getByText(/Eight specialist analyses are being prepared/)).toBeTruthy();
    fireEvent.submit(document.querySelector("form")!);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveResponse(jsonResponse(completeReport));
    expect(await screen.findByText("Complete report")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows validation errors without clearing the form", () => {
    render(<SimulationApp />);
    fillDecisionForm();
    fireEvent.click(screen.getByRole("button", { name: "← Back" }));
    fireEvent.click(screen.getByRole("button", { name: "← Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Build a meaningful career" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Feel engaged in daily life" }));
    fireEvent.click(screen.getByRole("button", { name: "Next →" }));

    expect(screen.getByText("At least one goal is required")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "← Back" }));
    fireEvent.click(screen.getByRole("button", { name: "← Back" }));
    expect((screen.getByLabelText("Your question") as HTMLInputElement).value).toBe(sampleDecision.question);
  });

  it("explains when the request exceeds the server size limit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      error: { code: "INVALID_REQUEST", message: "Request body exceeds the 32 KB limit." },
    }, 413)));
    render(<SimulationApp />);
    fillDecisionForm();

    fireEvent.click(screen.getByRole("button", { name: /Explore this decision/ }));

    expect(await screen.findByText(
      "Decision details exceed the request size limit. Shorten the text or remove list items and try again.",
    )).toBeTruthy();
    expect(screen.queryByText("Request body exceeds the 32 KB limit.")).toBeNull();
    expect(screen.getAllByText(sampleDecision.question).length).toBeGreaterThan(0);
  });

  it("does not expose server error details or stack traces", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      error: {
        code: "INTERNAL_ERROR",
        message: "private token; Error: database failed at C:\\secrets\\route.ts:14",
      },
    }, 500)));
    render(<SimulationApp />);
    fillDecisionForm();

    fireEvent.click(screen.getByRole("button", { name: /Explore this decision/ }));

    expect(await screen.findByText("The simulation is temporarily unavailable. Please try again.")).toBeTruthy();
    expect(screen.queryByText(/private token|database failed|route\.ts:14/)).toBeNull();
    expect(screen.getAllByText(sampleDecision.question).length).toBeGreaterThan(0);
  });

  it("shows an unexpected-response error for an invalid successful payload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      reportStatus: "complete",
      results: [],
    })));
    render(<SimulationApp />);
    fillDecisionForm();

    fireEvent.click(screen.getByRole("button", { name: /Explore this decision/ }));

    expect(await screen.findByText("The simulation returned an unexpected report. Please try again.")).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Complete report" })).toBeNull();
  });

  it("shows a network error and preserves the entered decision", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network details")));
    render(<SimulationApp />);
    fillDecisionForm();

    fireEvent.click(screen.getByRole("button", { name: /Explore this decision/ }));

    expect(await screen.findByText("Could not connect to the simulation. Check your connection and try again."))
      .toBeTruthy();
    expect(screen.queryByText("network details")).toBeNull();
    expect(screen.getAllByText(sampleDecision.question).length).toBeGreaterThan(0);
  });

  it("starts a fresh simulation after the app is refreshed", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(completeReport));
    vi.stubGlobal("fetch", fetchMock);
    const firstRender = render(<SimulationApp />);
    fillDecisionForm();
    fireEvent.click(screen.getByRole("button", { name: /Explore this decision/ }));
    expect(await screen.findByText("Complete report")).toBeTruthy();

    firstRender.unmount();
    render(<SimulationApp />);

    expect(screen.getByText("A little clarity starts here.")).toBeTruthy();
    expect((screen.getByLabelText("Your question") as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("button", { name: "Next →" }) as HTMLButtonElement).disabled).toBe(false);

    fillDecisionForm();
    fireEvent.click(screen.getByRole("button", { name: /Explore this decision/ }));
    expect(await screen.findByText("Complete report")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

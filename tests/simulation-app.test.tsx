// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import SimulationApp from "@/components/simulation-app";
import { AGENT_NAMES, OPTION_IDS } from "@/lib/agents/types";
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
  fireEvent.change(screen.getByLabelText("What decision are you facing?"), {
    target: { value: sampleDecision.question },
  });
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
  fireEvent.change(screen.getByLabelText("Goals"), {
    target: { value: sampleDecision.goals.join(", ") },
  });
  fireEvent.change(screen.getByLabelText("Priorities"), {
    target: { value: sampleDecision.priorities.join(", ") },
  });
  fireEvent.change(screen.getByLabelText("Other constraints (optional)"), {
    target: {
      value: (Array.isArray(sampleDecision.constraints)
        ? sampleDecision.constraints
        : sampleDecision.constraints.other).join(", "),
    },
  });
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

beforeAll(async () => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  completeReport = await runSimulation(sampleDecision);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe("SimulationApp", () => {
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
    expect((screen.getByLabelText("What decision are you facing?") as HTMLInputElement).value)
      .toBe(sampleDecision.question);
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
    fireEvent.submit(document.querySelector("form")!);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveResponse(jsonResponse(completeReport));
    expect(await screen.findByText("Complete report")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows validation errors without clearing the form", () => {
    render(<SimulationApp />);
    fillDecisionForm();
    fireEvent.change(screen.getByLabelText("Goals"), { target: { value: "" } });

    fireEvent.submit(document.querySelector("form")!);

    expect(screen.getByText("Enter at least one goal and one priority, separated by commas.")).toBeTruthy();
    expect((screen.getByLabelText("What decision are you facing?") as HTMLInputElement).value)
      .toBe(sampleDecision.question);
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
    expect((screen.getByLabelText("What decision are you facing?") as HTMLInputElement).value)
      .toBe(sampleDecision.question);
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
    expect(screen.queryByText("Complete report")).toBeNull();
  });

  it("shows a network error and preserves the entered decision", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network details")));
    render(<SimulationApp />);
    fillDecisionForm();

    fireEvent.click(screen.getByRole("button", { name: /Explore this decision/ }));

    expect(await screen.findByText("Could not connect to the simulation. Check your connection and try again."))
      .toBeTruthy();
    expect(screen.queryByText("network details")).toBeNull();
    expect((screen.getByLabelText("What decision are you facing?") as HTMLInputElement).value)
      .toBe(sampleDecision.question);
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
    expect((screen.getByLabelText("What decision are you facing?") as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("button", { name: /Explore this decision/ }) as HTMLButtonElement).disabled).toBe(false);

    fillDecisionForm();
    fireEvent.click(screen.getByRole("button", { name: /Explore this decision/ }));
    expect(await screen.findByText("Complete report")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

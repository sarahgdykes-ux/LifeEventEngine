import type { AgentExecutionSource, AgentName } from "@/lib/agents/types";
import type { DecisionInput } from "@/lib/schemas/decision";
import type { AgentResult, SimulationReport } from "@/lib/schemas/simulation";

const HORIZONS = [
  ["year1", 1],
  ["year5", 5],
  ["year10", 10],
] as const;
const STAT_NAMES = ["finances", "wellbeing", "health", "career"] as const;
type StatName = (typeof STAT_NAMES)[number];

export interface TimelineExportData {
  simulationId: string;
  timestamp: string;
  horizonYears: number[];
  decision: DecisionInput;
  report: SimulationReport;
  statDeltas: Record<string, Record<string, Partial<Record<StatName, number>>>>;
  agentSummaries: {
    agentId: AgentName;
    optionId: "A" | "B";
    narrative: string;
    projections: AgentResult["projections"];
    retriesUsed: number;
    source?: AgentExecutionSource;
  }[];
}

export function createTimelineExportData(
  decision: DecisionInput,
  report: SimulationReport,
  timestamp = new Date().toISOString(),
): TimelineExportData {
  const baselineStats = report.stateProjection?.baselineState.stats;
  const statDeltas: TimelineExportData["statDeltas"] = {};

  report.stateProjection?.options.forEach((option) => {
    statDeltas[option.optionId] = {};
    HORIZONS.forEach(([horizon]) => {
      const state = option.horizons[horizon].state;
      const deltas: Partial<Record<StatName, number>> = {};
      STAT_NAMES.forEach((stat) => {
        if (baselineStats) deltas[stat] = state.stats[stat] - baselineStats[stat];
      });
      statDeltas[option.optionId][horizon] = deltas;
    });
  });

  const agentSummaries = report.results.map((result) => ({
    agentId: result.agent,
    optionId: result.optionId,
    narrative: [
      "Findings:",
      ...result.findings.map((finding) => `- ${finding}`),
      "Assumptions:",
      ...result.assumptions.map((assumption) => `- ${assumption}`),
      "Uncertainties:",
      ...result.uncertainties.map((uncertainty) => `- ${uncertainty}`),
      `Self-reported confidence: ${result.confidence}% (not an outcome probability).`,
    ].join("\n"),
    projections: result.projections,
    retriesUsed: report.auditLog?.find(({ key }) => key === `${result.agent}:${result.optionId}`)?.retriesUsed ?? 0,
    source: report.auditLog?.find(({ key }) => key === `${result.agent}:${result.optionId}`)?.source,
  }));

  return {
    simulationId: report.decisionId,
    timestamp,
    horizonYears: HORIZONS.map(([, year]) => year),
    decision,
    report,
    statDeltas,
    agentSummaries,
  };
}

/** Downloads the complete simulation report as a JSON file in the browser. */
export function downloadJSONReport(data: TimelineExportData, filename = "simulation-report.json"): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement("a");
  downloadAnchor.href = url;
  downloadAnchor.download = filename;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  URL.revokeObjectURL(url);
}

/** Formats a shareable Markdown report from the same data included in the JSON export. */
export function generateMarkdownReport(data: TimelineExportData): string {
  const optionSections = data.decision.options.map((option) => {
    const synthesis = data.report.synthesis?.options.find(({ optionId }) => optionId === option.id);
    const scoreLines = synthesis
      ? [
          `- Financial health: ${synthesis.breakdownScores.financialHealth.value}/100`,
          `- Emotional wellbeing: ${synthesis.breakdownScores.emotionalWellbeing.value}/100`,
          `- Risk level: ${synthesis.breakdownScores.riskLevel.value}/100`,
        ].join("\n")
      : "Scores are unavailable because the Narrator did not produce a complete comparison.";
    const projection = data.report.stateProjection?.options.find(({ optionId }) => optionId === option.id);
    const stateLines = projection
      ? HORIZONS.map(([horizon, year]) => {
          const horizonState = projection.horizons[horizon];
          const deltas = data.statDeltas[option.id]?.[horizon] ?? {};
          const deltaText = STAT_NAMES.map((stat) => {
            const delta = deltas[stat];
            return `${stat}: ${typeof delta === "number" && delta > 0 ? "+" : ""}${delta ?? "n/a"}`;
          }).join(", ");
          return `- Year ${year}: ${deltaText}; trajectory ${projection.trajectoryReview.status}; ${horizonState.executionSummary}`;
        }).join("\n")
      : "No state projection was included in this report.";

    return [
      `## Option ${option.id}: ${option.label}`,
      option.description ? `\n${option.description}` : "",
      `\n### Breakdown scores\n${scoreLines}`,
      `\n### State projections\n${stateLines}`,
    ].filter(Boolean).join("\n");
  }).join("\n\n---\n\n");

  const agentSections = data.agentSummaries.map((summary) => [
    `### ${summary.agentId.toUpperCase()} · Option ${summary.optionId} (Source: ${summary.source ?? "unknown"}; Retries: ${summary.retriesUsed})`,
    summary.narrative,
    "",
    `- Year 1: ${summary.projections.year1}`,
    `- Year 5: ${summary.projections.year5}`,
    `- Year 10: ${summary.projections.year10}`,
  ].join("\n")).join("\n\n");
  const missingSection = data.report.missingResults.length > 0
    ? `\n\n## Missing specialist results\n${data.report.missingResults.map((key) => `- ${key}`).join("\n")}`
    : "";

  return [
    "# Life Decision Simulator Report",
    `**Generated:** ${data.timestamp}  \n**Simulation ID:** \`${data.simulationId}\`  \n**Status:** ${data.report.reportStatus}`,
    `\n## Decision\n${data.decision.question}`,
    optionSections,
    "## Specialist perspectives",
    agentSections || "No specialist results were returned.",
    missingSection,
    "\n---\n*These scenario projections are illustrative reflection prompts, not predictions or professional advice.*",
  ].join("\n\n");
}

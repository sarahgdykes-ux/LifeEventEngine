"use client";

import { useMemo, useState } from "react";
import { AGENT_NAMES, OPTION_IDS, type AgentName, type OptionId } from "@/lib/agents/types";
import { createTimelineExportData, downloadJSONReport, generateMarkdownReport } from "@/lib/export";
import type { DecisionInput } from "@/lib/schemas/decision";
import type { AgentResult, OptionSynthesis, SimulationReport } from "@/lib/schemas/simulation";

interface SimulationReportViewProps {
  report: SimulationReport;
  decision: DecisionInput;
}

const AGENT_LABELS: Record<AgentName, string> = {
  optimist: "Optimist",
  pessimist: "Pessimist",
  financial: "Financial",
  wellbeing: "Wellbeing",
};

const AGENT_IDENTITY: Record<AgentName, { icon: string; color: string; voice: string }> = {
  optimist: {
    icon: "☀️",
    color: "#f59e0b",
    voice: "Bright side",
  },
  pessimist: {
    icon: "☁️",
    color: "#64748b",
    voice: "What could go wrong",
  },
  financial: {
    icon: "💰",
    color: "#10b981",
    voice: "Numbers first",
  },
  wellbeing: {
    icon: "❤️",
    color: "#ef4444",
    voice: "How you'll feel",
  },
};

const SCORE_LABELS = {
  financialHealth: "Financial health",
  emotionalWellbeing: "Emotional wellbeing",
  riskLevel: "Risk level",
} as const;

const HORIZONS = [
  ["year1", "Year 1"],
  ["year5", "Year 5"],
  ["year10", "Year 10"],
] as const;
const STATE_STATS = ["finances", "wellbeing", "health", "career"] as const;

const TRADEOFF_LABELS = {
  financial: "Financial",
  wellbeing: "Wellbeing",
  opportunity: "Opportunity",
  risk: "Risk",
} as const;

function BreakdownScores({ synthesis }: { synthesis: OptionSynthesis }) {
  const [checkedQuestions, setCheckedQuestions] = useState<Set<string>>(new Set());
  const [importantQuestion, setImportantQuestion] = useState<string | null>(null);

  const REFLECTION_QUESTIONS = [
    "What would success look like in year 1?",
    "Which risks keep you up at night?",
    "Can you afford the transition costs?",
    "Who would support you through this?",
    "What would you regret not trying?",
    "How does this align with your long-term values?",
  ];

  function toggleQuestion(question: string) {
    setCheckedQuestions((current) => {
      const next = new Set(current);
      if (next.has(question)) {
        next.delete(question);
      } else {
        next.add(question);
      }
      return next;
    });
  }

  function selectImportantQuestion(question: string) {
    setImportantQuestion(question);
  }

  return (
    <section className="breakdown-scores" aria-label={`Option ${synthesis.optionId} reflection questions`}>
      <h4 className="questions-title">Questions to ask yourself</h4>
      <p className="questions-subtitle">Check the questions that matter most to you</p>
      <ul className="questions-list">
        {REFLECTION_QUESTIONS.map((question) => (
          <li key={question} className="question-item">
            <label className="question-checkbox">
              <input
                type="checkbox"
                checked={checkedQuestions.has(question)}
                onChange={() => toggleQuestion(question)}
              />
              <span>{question}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="important-question-section">
        <h5 className="important-question-title">Your key question</h5>
        <p className="important-question-subtitle">Which single question matters most to you right now?</p>
        <div className="important-question-grid">
          {REFLECTION_QUESTIONS.map((question) => (
            <button
              key={question}
              className={`important-question-card ${importantQuestion === question ? "important-question-selected" : ""}`}
              onClick={() => selectImportantQuestion(question)}
              type="button"
            >
              {importantQuestion === question && <span className="check-icon" aria-hidden="true">✓</span>}
              <span>{question}</span>
            </button>
          ))}
        </div>
        {importantQuestion && (
          <p className="important-question-acknowledgment">
            This question will help guide your reflection.
          </p>
        )}
      </div>
    </section>
  );
}

function NarratorComparison({ synthesis }: { synthesis: OptionSynthesis }) {
  return (
    <section className="narrator-comparison" aria-label={`Narrator comparison for option ${synthesis.optionId}`}>
      <p className="narrator-evidence-note">
        Each excerpt is quoted from the named agent. These are agent perspectives, not verified facts; assumptions, uncertainties, and confidence are preserved in the perspectives below.
      </p>
      <h5>Key findings by perspective</h5>
      <ul className="narrator-findings">
        {synthesis.strongestFindings.map(({ agent, finding }) => (
          <li key={agent}><strong>{AGENT_LABELS[agent]}:</strong> {finding}</li>
        ))}
      </ul>
      <h5>Trade-offs to consider</h5>
      <div className="narrator-tradeoffs">
        {synthesis.tradeoffs.map(({ perspective, decisionQuestion, evidence }) => (
          <section key={perspective}>
            <h6>{TRADEOFF_LABELS[perspective]}</h6>
            <p><strong>Consider:</strong> {decisionQuestion}</p>
            {evidence.map(({ agent, finding }, index) => (
              <p key={`${agent}-${index}`}><strong>{AGENT_LABELS[agent]}:</strong> {finding}</p>
            ))}
          </section>
        ))}
      </div>
      <div className="narrator-alignment">
        <section>
          <h5>Shared findings</h5>
          {synthesis.agreements.length > 0 ? (
            <ul>{synthesis.agreements.map(({ finding, agents }) => (
              <li key={finding}><strong>{agents.map((agent) => AGENT_LABELS[agent]).join(", ")}:</strong> {finding}</li>
            ))}</ul>
          ) : <p>No identical finding was shared by multiple agents.</p>}
        </section>
        <section>
          <h5>Direct disagreements</h5>
          {synthesis.disagreements.length > 0 ? (
            <ul>{synthesis.disagreements.map(({ evidence }, index) => (
              <li key={index}>{evidence.map(({ agent, finding }) => (
                <p key={agent}><strong>{AGENT_LABELS[agent]}:</strong> {finding}</p>
              ))}</li>
            ))}</ul>
          ) : <p>No direct contradiction was identified; different emphases are not necessarily disagreement.</p>}
        </section>
      </div>
    </section>
  );
}

function TimelineVisualization({ synthesis, optionLabel }: { synthesis: OptionSynthesis; optionLabel: string }) {
  return (
    <section className="timeline-visualization" aria-label={`Timeline for ${optionLabel}`}>
      <h4 className="timeline-title">Timeline projections</h4>
      <p className="timeline-subtitle">How each specialist sees this option over time</p>
      <div className="timeline-grid">
        {HORIZONS.map(([key, label]) => (
          <div key={key} className="timeline-column">
            <div className="timeline-header">
              <span className="timeline-year">{label}</span>
            </div>
            <div className="timeline-perspectives">
              {synthesis.timeline[key].map(({ agent, projection }) => {
                const identity = AGENT_IDENTITY[agent];
                return (
                  <div key={agent} className="timeline-perspective" style={{ borderTopColor: identity.color }}>
                    <div className="timeline-perspective-header">
                      <span className="timeline-agent-icon" aria-hidden="true">{identity.icon}</span>
                      <span className="timeline-agent-name">{AGENT_LABELS[agent]}</span>
                    </div>
                    <p className="timeline-projection">{projection}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AgentResultCard({ result }: { result: AgentResult }) {
  const identity = AGENT_IDENTITY[result.agent];
  return (
    <article className={`agent-result agent-result-${result.agent}${result.status === "complete" ? "" : " agent-result-incomplete"}`}>
      <div className="result-title-row">
        <div>
          <p className="result-kicker" style={{ color: identity.color }}>
            <span className="agent-icon" aria-hidden="true">{identity.icon}</span>
            {identity.voice}
          </p>
          <h4>{AGENT_LABELS[result.agent]}</h4>
        </div>
        <span className={`result-status result-status-${result.status}`}>{result.status}</span>
      </div>
      {result.status !== "complete" && (
        <p className="result-incomplete-note">
          This perspective is marked {result.status} and is not counted as a complete result.
        </p>
      )}
      <section className="result-section">
        <h5>Findings</h5>
        <ul>{result.findings.map((finding, index) => <li key={`${index}-${finding}`}>{finding}</li>)}</ul>
      </section>
      <div className="result-detail-grid">
        <section className="result-section">
          <h5>Assumptions</h5>
          <ul>{result.assumptions.map((assumption, index) => <li key={`${index}-${assumption}`}>{assumption}</li>)}</ul>
        </section>
        <section className="result-section">
          <h5>Uncertainties</h5>
          <ul>{result.uncertainties.map((uncertainty, index) => <li key={`${index}-${uncertainty}`}>{uncertainty}</li>)}</ul>
        </section>
      </div>
      <p className="confidence-note">
        Self-reported confidence: <strong>{result.confidence}%</strong>
        <span> This is an analysis rating, not a probability of an outcome.</span>
      </p>
      <section className="projections" aria-label={`${AGENT_LABELS[result.agent]} illustrative projections`}>
        <h5>Illustrative projections · not predictions</h5>
        <div className="projection-grid">
          {HORIZONS.map(([key, label]) => (
            <section key={key}>
              <span>{label}</span>
              <p>{result.projections[key]}</p>
            </section>
          ))}
        </div>
      </section>
    </article>
  );
}

function MissingResultCard({ agent, optionId }: { agent: AgentName; optionId: OptionId }) {
  return (
    <article className="missing-result-card">
      <h4>{AGENT_LABELS[agent]}</h4>
      <p>No validated result was returned for this agent and option. No perspective has been substituted.</p>
      <code>{agent}:{optionId}</code>
    </article>
  );
}

function AuditResultCard({
  result,
  retriesUsed,
}: {
  result: AgentResult;
  retriesUsed: number;
}) {
  return (
    <article className="audit-result-card">
      <div className="audit-result-heading">
        <strong>{AGENT_LABELS[result.agent]} · Option {result.optionId}</strong>
        <span className={`retry-badge${retriesUsed > 0 ? " retry-badge-used" : " retry-badge-clean"}`}>
          {retriesUsed > 0 ? `${retriesUsed} ${retriesUsed === 1 ? "retry" : "retries"} required` : "0 retries (clean)"}
        </span>
      </div>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </article>
  );
}

function OptionPerspective({
  option,
  results,
  synthesis,
}: {
  option: DecisionInput["options"][number];
  results: SimulationReport["results"];
  synthesis?: OptionSynthesis;
}) {
  return (
    <section className={`option-perspective option-perspective-${option.id.toLowerCase()}`} aria-labelledby={`option-${option.id}-results`}>
      <h3 id={`option-${option.id}-results`}>
        <span className={`option-marker option-marker-${option.id.toLowerCase()}`}>{option.id}</span>
        <span>{option.label}</span>
      </h3>
      {option.description && <p className="option-perspective-description">{option.description}</p>}
      {synthesis && <TimelineVisualization synthesis={synthesis} optionLabel={option.label} />}
      <div className="option-agent-results">
        {AGENT_NAMES.map((agent) => {
          const result = results.find((candidate) => candidate.agent === agent && candidate.optionId === option.id);
          return result
            ? <AgentResultCard key={agent} result={result} />
            : <MissingResultCard key={agent} agent={agent} optionId={option.id} />;
        })}
      </div>
    </section>
  );
}

export default function SimulationReportView({ report, decision }: SimulationReportViewProps) {
  const [auditAgent, setAuditAgent] = useState<AgentName>("optimist");
  const [exportMessage, setExportMessage] = useState("");
  const exportData = useMemo(() => createTimelineExportData(decision, report), [decision, report]);
  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(generateMarkdownReport(exportData));
      setExportMessage("Markdown report copied to clipboard.");
    } catch {
      setExportMessage("Could not access the clipboard. Check browser permissions and try again.");
    }
  };
  const missingResultDetails = report.missingResults.map((key) => {
    const [agentKey, optionKey] = key.split(":");
    const agent = AGENT_NAMES.find((candidate) => candidate === agentKey);
    const optionId = OPTION_IDS.find((candidate) => candidate === optionKey);
    if (!agent || !optionId) return null;
    const result = report.results.find((candidate) => candidate.agent === agent && candidate.optionId === optionId);
    return { key, agent, optionId, status: result?.status };
  }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return (
    <div className="report-content">
      <div className={`report-status report-status-${report.reportStatus}`} role="status">
        <span className="report-status-indicator" aria-hidden="true" />
        {report.reportStatus === "partial" ? "Partial report" : report.reportStatus === "complete" ? "Complete report" : "Report failed"}
      </div>
      <h2 className="report-question">{decision.question}</h2>
      {report.reportStatus === "partial" && (
        <p className="report-status-explanation">
          Some specialist results are missing or incomplete. The perspectives shown below were returned, but this report is not a complete comparison.
        </p>
      )}
      {report.reportStatus === "complete" && (
        <p className="report-status-explanation report-status-complete-explanation">
          All eight specialist results passed validation. “Complete” describes coverage only; these illustrative perspectives are not verified facts, predictions, or recommendations.
        </p>
      )}
      {report.reportStatus === "failed" && (
        <p className="report-status-explanation">
          No specialist returned a complete result. Any returned details are shown below; missing perspectives have not been filled in.
        </p>
      )}

      <section className="report-export" aria-label="Export report">
        <div>
          <h3>Export report</h3>
          <p>Download the full simulation as JSON or copy a formatted Markdown summary.</p>
        </div>
        <div className="report-export-actions">
          <button type="button" onClick={() => downloadJSONReport(exportData, `life-decision-report-${report.decisionId}.json`)}>
            Download JSON
          </button>
          <button type="button" onClick={copyMarkdown}>Copy Markdown report</button>
        </div>
        {exportMessage && <p className="report-export-message" role="status">{exportMessage}</p>}
      </section>

      {report.stateProjection && (
        <section className="state-projection-report" aria-labelledby="state-projection-title">
          <h3 id="state-projection-title">State projections from your assumptions</h3>
          <p>Each horizon is projected independently from the same baseline. The entered deltas are scenario assumptions, not predictions.</p>
          <div className="state-projection-options">
            {report.stateProjection.options.map((optionProjection) => {
              const option = decision.options.find(({ id }) => id === optionProjection.optionId);
              if (!option) return null;
              return (
                <section className="state-projection-option" key={optionProjection.optionId}>
                  <h4>Option {optionProjection.optionId}: {option.label}</h4>
                  <div className="state-projection-horizons">
                    {HORIZONS.map(([horizon, label]) => {
                      const projection = optionProjection.horizons[horizon];
                      return (
                        <article key={horizon}>
                          <h5>{label} · Age {projection.state.character.age} · {projection.state.year}</h5>
                          <dl>{STATE_STATS.map((stat) => (
                            <div key={stat}><dt>{stat}</dt><dd>{projection.state.stats[stat]}</dd></div>
                          ))}</dl>
                          <p>{projection.executionSummary}</p>
                          {projection.correctionReasons.length > 0 && <p className="trajectory-warning">Safe fallback used: {projection.correctionReasons.join("; ")}</p>}
                        </article>
                      );
                    })}
                  </div>
                  <p className={`trajectory-status trajectory-status-${optionProjection.trajectoryReview.status}`}>
                    Trajectory review: {optionProjection.trajectoryReview.status.replace("_", " ")}
                  </p>
                  {optionProjection.trajectoryReview.flags.length > 0 && (
                    <ul>{optionProjection.trajectoryReview.flags.map((flag) => <li key={flag}>{flag}</li>)}</ul>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      )}

      {report.synthesis && (
        <section className="report-overview" aria-labelledby="report-overview-heading">
          <h3 id="report-overview-heading">At-a-glance comparison</h3>
          <p className="score-explanation">Use these questions to guide your reflection, not as predictions or advice.</p>
          <div className="overview-options">
            {report.synthesis.options.map((synthesis) => {
              const option = decision.options.find(({ id }) => id === synthesis.optionId);
              return option && (
                <section className="overview-option" key={option.id} aria-label={`Option ${option.id}: ${option.label}`}>
                  <h4><span className={`option-marker option-marker-${option.id.toLowerCase()}`}>{option.id}</span>{option.label}</h4>
                  <BreakdownScores synthesis={synthesis} />
                  <NarratorComparison synthesis={synthesis} />
                </section>
              );
            })}
          </div>
        </section>
      )}

      {missingResultDetails.length > 0 && (
        <section className="missing-notice" aria-labelledby="missing-results-heading">
          <h3 id="missing-results-heading">Missing or incomplete results</h3>
          <p>These agent-option results are not complete. No substitute content was created.</p>
          <ul>
            {missingResultDetails.map(({ key, agent, optionId, status }) => (
              <li key={key}>
                <span>{AGENT_LABELS[agent]} · Option {optionId}</span>
                <code>{status ? `${status} · ${key}` : `not returned · ${key}`}</code>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="perspectives-section" aria-labelledby="perspectives-heading">
        <div className="perspectives-heading">
          <h3 id="perspectives-heading">Perspectives by option</h3>
          <p>Each agent’s assumptions, uncertainties, and time horizons are shown separately. Projections are illustrative scenarios, not guaranteed outcomes.</p>
        </div>
        <div className="option-perspective-grid">
          {decision.options.map((option) => {
            const synthesis = report.synthesis?.options.find((s) => s.optionId === option.id);
            return (
              <OptionPerspective key={option.id} option={option} results={report.results} synthesis={synthesis} />
            );
          })}
        </div>
      </section>

      <details className="developer-audit">
        <summary>Developer audit view</summary>
        <p>Validated handoff records and raw structured outputs returned by each specialist.</p>
        <div className="audit-tabs" role="tablist" aria-label="Raw agent outputs">
          {AGENT_NAMES.map((agent) => (
            <button
              aria-selected={auditAgent === agent}
              id={`audit-tab-${agent}`}
              key={agent}
              onClick={() => setAuditAgent(agent)}
              role="tab"
              type="button"
            >{AGENT_LABELS[agent]}</button>
          ))}
        </div>
        <section aria-labelledby={`audit-tab-${auditAgent}`} className="audit-panel" role="tabpanel">
          {report.results.filter(({ agent }) => agent === auditAgent).map((result) => {
            const handoff = report.auditLog?.find((entry) => entry.key === `${result.agent}:${result.optionId}`);
            return (
              <AuditResultCard
                key={result.optionId}
                result={result}
                retriesUsed={handoff?.retriesUsed ?? 0}
              />
            );
          })}
        </section>
        <h4>Handoff audit log</h4>
        {report.auditLog?.length ? (
          <ol className="audit-log">{report.auditLog.map((entry, index) => (
            <li key={`${entry.key}-${index}`}><code>{entry.stage} · {entry.outcome} · {entry.key}</code><span>{entry.detail}</span></li>
          ))}</ol>
        ) : <p>No handoff audit records were included in this report.</p>}
      </details>

      <p className="report-disclaimer">Use these perspectives as prompts for reflection, not as predictions or recommendations.</p>
    </div>
  );
}

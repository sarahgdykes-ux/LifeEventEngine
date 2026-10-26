import type { DecisionInput } from "@/lib/schemas/decision";
import type { AgentName } from "@/lib/agents/types";
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

const SCORE_LABELS = {
  financialHealth: "Financial health",
  emotionalWellbeing: "Emotional wellbeing",
  riskLevel: "Risk level",
} as const;

function AgentResultCard({ result }: { result: AgentResult }) {
  return (
    <article className="agent-result">
      <div className="result-title-row">
        <div><p className="result-kicker">VALIDATED PERSPECTIVE</p><h3>{AGENT_LABELS[result.agent]} <span>· Option {result.optionId}</span></h3></div>
        <span className={`result-status result-status-${result.status}`}>{result.status}</span>
      </div>
      <section className="result-section">
        <h4>Findings</h4>
        <ul>{result.findings.map((finding, index) => <li key={`${index}-${finding}`}>{finding}</li>)}</ul>
      </section>
      <div className="result-detail-grid">
        <section className="result-section">
          <h4>Assumptions</h4>
          <ul>{result.assumptions.map((assumption, index) => <li key={`${index}-${assumption}`}>{assumption}</li>)}</ul>
        </section>
        <section className="result-section">
          <h4>Uncertainties</h4>
          <ul>{result.uncertainties.map((uncertainty, index) => <li key={`${index}-${uncertainty}`}>{uncertainty}</li>)}</ul>
        </section>
      </div>
      <p className="confidence-note">Self-reported confidence: <strong>{result.confidence}%</strong></p>
    </article>
  );
}

function BreakdownScores({ synthesis }: { synthesis: OptionSynthesis }) {
  return (
    <section className="breakdown-scores" aria-label={`Option ${synthesis.optionId} breakdown scores`}>
      {Object.entries(synthesis.breakdownScores).map(([name, score]) => (
        <article className="score-card" key={name}>
          <div><h4>{SCORE_LABELS[name as keyof typeof SCORE_LABELS]}</h4><strong>{score.value}<span>/100</span></strong></div>
          <p>{score.rationale}</p>
        </article>
      ))}
    </section>
  );
}

function OptionSynthesis({ synthesis, label }: { synthesis: OptionSynthesis; label: string }) {
  return (
    <article className="option-synthesis">
      <h3><span className={`option-marker option-marker-${synthesis.optionId.toLowerCase()}`}>{synthesis.optionId}</span>{label}</h3>
      <BreakdownScores synthesis={synthesis} />
      <div className="synthesis-timeline">
        {(["year1", "year5", "year10"] as const).map((horizon) => (
          <section className="synthesis-horizon" key={horizon}>
            <h4>{horizon === "year1" ? "1 year" : horizon === "year5" ? "5 years" : "10 years"}</h4>
            <ul>
              {synthesis.timeline[horizon].map(({ agent, projection }) => (
                <li key={agent}><strong>{AGENT_LABELS[agent]}</strong><p>{projection}</p></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}

export default function SimulationReportView({ report, decision }: SimulationReportViewProps) {
  return (
    <div className="report-content">
      <div className={`report-status report-status-${report.reportStatus}`}>
        <span className="report-status-indicator" aria-hidden="true" />
        {report.reportStatus === "partial" ? "Partial report" : report.reportStatus === "complete" ? "Complete report" : "Report unavailable"}
      </div>
      <h2 className="report-question">{decision.question}</h2>
      <div className="report-options" aria-label="Options in this decision">
        {decision.options.map((option) => <p key={option.id}><span className={`option-marker option-marker-${option.id.toLowerCase()}`}>{option.id}</span><span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span></p>)}
      </div>
      {report.synthesis ? (
        <>
          <h3 className="synthesis-heading">Side-by-side possible futures</h3>
          <p className="score-explanation">Scores use a 0–100 scale, where higher risk means greater downside exposure. Current neutral scores are placeholders because the simulator does not yet collect personal financial or wellbeing baselines; they are not measured predictions or advice.</p>
          <div className="synthesis-options">
            {report.synthesis.options.map((optionSynthesis) => {
              const option = decision.options.find(({ id }) => id === optionSynthesis.optionId);
              return option && <OptionSynthesis key={option.id} synthesis={optionSynthesis} label={option.label} />;
            })}
          </div>
        </>
      ) : (
        <section className="report-unavailable">
          <h3>Side-by-side summary unavailable</h3>
          <p>The specialist set did not complete, so no synthesized summary was produced.</p>
          {report.missingResults.length > 0 && <p>Incomplete results: {report.missingResults.join(", ")}</p>}
        </section>
      )}
      <details className="raw-agent-results">
        <summary>Inspect individual agent outputs</summary>
        <div className="result-list">
          {report.results.map((result) => <AgentResultCard key={`${result.agent}:${result.optionId}`} result={result} />)}
        </div>
      </details>
      <p className="report-disclaimer">These illustrative scenarios are prompts for reflection, not predictions or recommendations.</p>
    </div>
  );
}

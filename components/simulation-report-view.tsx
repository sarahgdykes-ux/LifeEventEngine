import type { DecisionInput } from "@/lib/schemas/decision";
import type { AgentName } from "@/lib/agents/types";
import type { AgentResult, SimulationReport } from "@/lib/schemas/simulation";

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

function AgentResultCard({ result }: { result: AgentResult }) {
  return (
    <article className="agent-result">
      <div className="result-title-row">
        <div><p className="result-kicker">AVAILABLE PERSPECTIVE</p><h3>{AGENT_LABELS[result.agent]} <span>· Option {result.optionId}</span></h3></div>
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
      <div className="projections">
        <h4>Possible horizons</h4>
        <div className="projection-grid">
          <section><span>1 year</span><p>{result.projections.year1}</p></section>
          <section><span>5 years</span><p>{result.projections.year5}</p></section>
          <section><span>10 years</span><p>{result.projections.year10}</p></section>
        </div>
      </div>
      <p className="confidence-note">Self-reported confidence: <strong>{result.confidence}%</strong></p>
    </article>
  );
}

function MissingResultsNotice({ missingResults }: { missingResults: string[] }) {
  if (!missingResults.length) return null;

  return (
    <section className="missing-notice" aria-labelledby="missing-title">
      <h3 id="missing-title">Perspectives not available yet</h3>
      <p>These views have not been generated, so they are not included as results.</p>
      <ul>
        {missingResults.map((key) => {
          const [agent, optionId] = key.split(":");
          const agentLabel = AGENT_LABELS[agent as AgentName] ?? agent;
          return <li key={key}><span>{agentLabel} perspective · Option {optionId}</span><details><summary>Key</summary><code>{key}</code></details></li>;
        })}
      </ul>
    </section>
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
      {report.results.length ? (
        <div className="result-list">
          {report.results.map((result) => <AgentResultCard key={`${result.agent}:${result.optionId}`} result={result} />)}
        </div>
      ) : <p className="no-results">No perspective results are available for this report.</p>}
      <MissingResultsNotice missingResults={report.missingResults} />
      <p className="report-disclaimer">These are prompts for reflection, not predictions or recommendations.</p>
    </div>
  );
}
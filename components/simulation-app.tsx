"use client";

import { useRef, useState } from "react";
import DecisionForm from "@/components/decision-form";
import SimulationReportView from "@/components/simulation-report-view";
import type { DecisionInput } from "@/lib/schemas/decision";
import { SimulationApiErrorSchema } from "@/lib/schemas/api";
import { SimulationReportSchema, type SimulationReport } from "@/lib/schemas/simulation";

type RequestErrorKind = "validation" | "server" | "network" | "response";

interface RequestError {
  kind: RequestErrorKind;
  message: string;
}

class SimulationRequestError extends Error {
  constructor(readonly kind: RequestErrorKind, message: string) {
    super(message);
  }
}

const ERROR_TITLES: Record<RequestErrorKind, string> = {
  validation: "Check your decision details",
  server: "The simulation could not finish",
  network: "Connection problem",
  response: "Unexpected response",
};

export default function SimulationApp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<RequestError | null>(null);
  const [report, setReport] = useState<SimulationReport | null>(null);
  const [reportedDecision, setReportedDecision] = useState<DecisionInput | null>(null);
  const submissionInProgress = useRef(false);

  async function submitDecision(decision: DecisionInput) {
    if (submissionInProgress.current) return;
    submissionInProgress.current = true;
    setLoading(true);
    setError(null);
    setReport(null);
    setReportedDecision(null);

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(decision),
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        if (response.status >= 500) {
          throw new SimulationRequestError("server", `The server returned an error (${response.status}). Please try again.`);
        }
        throw new SimulationRequestError(
          response.ok ? "response" : "validation",
          response.ok
            ? "The simulation returned an unreadable response. Please try again."
            : "The request could not be validated. Check the required fields and try again.",
        );
      }

      if (!response.ok) {
        const apiError = SimulationApiErrorSchema.safeParse(payload);
        if (apiError.success) {
          throw new SimulationRequestError(
            response.status === 400 || apiError.data.error.code === "INVALID_REQUEST" ? "validation" : "server",
            apiError.data.error.message,
          );
        }
        throw new SimulationRequestError(
          response.status >= 500 ? "server" : "validation",
          response.status >= 500
            ? "The simulation is temporarily unavailable. Please try again."
            : "The request could not be validated. Check the required fields and try again.",
        );
      }

      const parsedReport = SimulationReportSchema.safeParse(payload);
      if (!parsedReport.success) {
        throw new SimulationRequestError("response", "The simulation returned an unexpected report. Please try again.");
      }

      setReport(parsedReport.data);
      setReportedDecision(decision);
    } catch (caught: unknown) {
      if (caught instanceof SimulationRequestError) {
        setError({ kind: caught.kind, message: caught.message });
      } else if (caught instanceof TypeError) {
        setError({
          kind: "network",
          message: "Could not connect to the simulation. Check your connection and try again.",
        });
      } else {
        setError({
          kind: "server",
          message: "Something went wrong while preparing the simulation. Please try again.",
        });
      }
    } finally {
      submissionInProgress.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Life Decision Simulator home">
          <span className="wordmark-mark" aria-hidden="true">L</span>
          <span>Life Decision<br />Simulator</span>
        </a>
        <span className="topbar-note"><span className="status-dot" /> Day 1 · Decision exploration</span>
      </header>

      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">MAKE SPACE FOR WHAT MATTERS</p>
        <h1 id="page-title">See both paths<br className="desktop-break" /> more clearly.</h1>
        <p className="intro-copy">Bring a real decision, name what matters to you, and explore the possibilities one step at a time.</p>
      </section>

      <div className="workspace">
        <section className="input-column" aria-labelledby="form-title">
          <div className="section-heading">
            <span className="step-number">01</span>
            <div>
              <h2 id="form-title">Your decision</h2>
              <p>Start with the question and the two options in front of you.</p>
            </div>
          </div>
          {error && <div className="error-panel" role="alert"><span className="error-symbol" aria-hidden="true">!</span><div><h3>{ERROR_TITLES[error.kind]}</h3><p>{error.message}</p></div></div>}
          <DecisionForm loading={loading} onSubmit={submitDecision} />
        </section>

        <section className="report-column" aria-labelledby="report-column-title" aria-live="polite" aria-busy={loading}>
          <div className="section-heading report-heading">
            <span className="step-number step-number-alt">02</span>
            <div>
              <h2 id="report-column-title">Your perspective report</h2>
              <p>What might each path make possible?</p>
            </div>
          </div>
          {loading ? (
            <div className="loading-panel" role="status">
              <span className="loading-spinner" aria-hidden="true" />
              <div><h3>Considering both options</h3><p>Four perspectives are being prepared in parallel. This can take a moment.</p></div>
            </div>
          ) : report && reportedDecision ? (
            <SimulationReportView report={report} decision={reportedDecision} />
          ) : (
            <div className="empty-report">
              <div className="empty-mark" aria-hidden="true"><span /><span /></div>
              <h3>A little clarity starts here.</h3>
              <p>Enter your decision and submit the form to compare perspectives for both options.</p>
              <span className="empty-footnote">Exploratory scores, not predictions.</span>
            </div>
          )}
        </section>
      </div>

      <footer className="page-footer"><span>Thoughtful decisions take time.</span><span>Explore possibilities, not predictions.</span></footer>
    </main>
  );
}
"use client";

import { useState, type FormEvent } from "react";
import type { DecisionInput } from "@/lib/schemas/decision";

interface DecisionFormProps {
  loading: boolean;
  onSubmit: (decision: DecisionInput) => void;
}

interface FormValues {
  question: string;
  optionALabel: string;
  optionADescription: string;
  optionBLabel: string;
  optionBDescription: string;
  goals: string;
  priorities: string;
  constraints: string;
}

const STAT_FIELDS = ["finances", "wellbeing", "health", "career"] as const;
const HORIZONS = [
  ["year1", "Year 1"],
  ["year5", "Year 5"],
  ["year10", "Year 10"],
] as const;
type StatField = (typeof STAT_FIELDS)[number];
type HorizonField = (typeof HORIZONS)[number][0];
interface ScenarioFormValue {
  optionId: "A" | "B";
  horizons: Record<HorizonField, Record<StatField, number>>;
  newCommitments: string;
  endedCommitments: string;
}

function emptyDeltas(): Record<StatField, number> {
  return { finances: 0, wellbeing: 0, health: 0, career: 0 };
}

function initialScenario(optionId: "A" | "B"): ScenarioFormValue {
  return {
    optionId,
    horizons: { year1: emptyDeltas(), year5: emptyDeltas(), year10: emptyDeltas() },
    newCommitments: "",
    endedCommitments: "",
  };
}

const INITIAL_VALUES: FormValues = {
  question: "",
  optionALabel: "",
  optionADescription: "",
  optionBLabel: "",
  optionBDescription: "",
  goals: "",
  priorities: "",
  constraints: "",
};

function splitList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export default function DecisionForm({ loading, onSubmit }: DecisionFormProps) {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [baseline, setBaseline] = useState({
    name: "Alex",
    age: 28,
    year: 2026,
    background: "",
    finances: 50,
    wellbeing: 50,
    health: 50,
    career: 50,
    commitments: "",
  });
  const [scenarioValues, setScenarioValues] = useState<ScenarioFormValue[]>([
    initialScenario("A"), initialScenario("B"),
  ]);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  function updateValue(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function updateBaseline(field: keyof typeof baseline, value: string) {
    setBaseline((current) => ({ ...current, [field]: field === "age" || field === "year" || STAT_FIELDS.includes(field as StatField) ? Number(value) : value }));
  }

  function updateScenario(
    optionId: "A" | "B",
    update: (scenario: ScenarioFormValue) => ScenarioFormValue,
  ) {
    setScenarioValues((current) => current.map((scenario) => scenario.optionId === optionId ? update(scenario) : scenario));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const goals = splitList(values.goals);
    const priorities = splitList(values.priorities);

    if (!values.question.trim() || !values.optionALabel.trim() || !values.optionBLabel.trim()) {
      setValidationMessage("Enter a decision question and a label for each option.");
      return;
    }

    if (!goals.length || !priorities.length) {
      setValidationMessage("Enter at least one goal and one priority, separated by commas.");
      return;
    }

    if (!baseline.name.trim() || !Number.isInteger(baseline.age) || baseline.age < 0 || baseline.age > 120
      || !Number.isInteger(baseline.year) || baseline.year < 0 || baseline.year > 9989
      || STAT_FIELDS.some((stat) => !Number.isInteger(baseline[stat]) || baseline[stat] < 0 || baseline[stat] > 100)) {
      setValidationMessage("Check the baseline name, age, year, and stat values before continuing.");
      return;
    }

    const invalidEffects = scenarioValues.some((scenario) =>
      HORIZONS.some(([horizon]) => STAT_FIELDS.some((stat) =>
        !Number.isInteger(scenario.horizons[horizon][stat])
        || scenario.horizons[horizon][stat] < -20
        || scenario.horizons[horizon][stat] > 20,
      ))
      || splitList(scenario.newCommitments).some((item) => splitList(scenario.endedCommitments).includes(item)),
    );
    if (invalidEffects) {
      setValidationMessage("Each scenario delta must be an integer from −20 to +20, and a commitment cannot be both new and ended.");
      return;
    }

    setValidationMessage(null);
    onSubmit({
      question: values.question.trim(),
      options: [
        { id: "A", label: values.optionALabel.trim(), description: values.optionADescription.trim() || undefined },
        { id: "B", label: values.optionBLabel.trim(), description: values.optionBDescription.trim() || undefined },
      ],
      goals,
      priorities,
      constraints: { other: splitList(values.constraints) },
      baselineState: {
        character: { name: baseline.name.trim(), age: baseline.age, background: baseline.background.trim() || "Not specified" },
        year: baseline.year,
        stats: {
          finances: baseline.finances,
          wellbeing: baseline.wellbeing,
          health: baseline.health,
          career: baseline.career,
        },
        commitments: splitList(baseline.commitments),
      },
      scenarioEffects: scenarioValues.map(({ optionId, horizons, newCommitments, endedCommitments }) => ({
        optionId,
        horizons,
        commitments: { new: splitList(newCommitments), ended: splitList(endedCommitments) },
      })),
    });
  }

  return (
    <form className="decision-form" onSubmit={handleSubmit} aria-busy={loading} noValidate>
      <div className="form-section">
        <label className="field-label" htmlFor="decision-question">What decision are you facing?</label>
        <input
          id="decision-question"
          name="question"
          type="text"
          value={values.question}
          onChange={(event) => updateValue("question", event.target.value)}
          placeholder="Should I go to graduate school or move to a new city?"
          required
        />
      </div>

      <details className="form-section state-input-section">
        <summary>Shared baseline state</summary>
        <p className="field-help">Use rough starting values for this scenario. These are assumptions for projection, not measured assessments.</p>
        <div className="list-grid">
          <label className="field-label" htmlFor="baseline-name">Character name
            <input id="baseline-name" value={baseline.name} onChange={(event) => updateBaseline("name", event.target.value)} />
          </label>
          <label className="field-label" htmlFor="baseline-age">Age
            <input id="baseline-age" type="number" min="0" max="120" value={baseline.age} onChange={(event) => updateBaseline("age", event.target.value)} />
          </label>
          <label className="field-label" htmlFor="baseline-year">Current year
            <input id="baseline-year" type="number" min="0" max="9989" value={baseline.year} onChange={(event) => updateBaseline("year", event.target.value)} />
          </label>
          <label className="field-label" htmlFor="baseline-background">Background
            <input id="baseline-background" value={baseline.background} onChange={(event) => updateBaseline("background", event.target.value)} placeholder="Optional context" />
          </label>
        </div>
        <div className="state-stat-grid">
          {STAT_FIELDS.map((stat) => (
            <label className="field-label" htmlFor={`baseline-${stat}`} key={stat}>{stat[0].toUpperCase() + stat.slice(1)} (0–100)
              <input id={`baseline-${stat}`} type="number" min="0" max="100" value={baseline[stat]} onChange={(event) => updateBaseline(stat, event.target.value)} />
            </label>
          ))}
        </div>
        <label className="field-label" htmlFor="baseline-commitments">Current commitments
          <input id="baseline-commitments" value={baseline.commitments} onChange={(event) => updateBaseline("commitments", event.target.value)} placeholder="Current job, lease" />
        </label>

        <details className="scenario-assumptions">
          <summary>Scenario assumptions by option and horizon</summary>
          <p className="field-help">Enter estimated stat changes from the shared baseline at each horizon. Deltas are clamped to −20 through +20 per stat. Leave zero when you do not want to assume a change.</p>
          {scenarioValues.map((scenario) => (
            <fieldset className="scenario-option-assumptions" key={scenario.optionId}>
              <legend>Option {scenario.optionId}</legend>
              {HORIZONS.map(([horizon, label]) => (
                <div className="scenario-horizon" key={horizon}>
                  <h4>{label} stat changes</h4>
                  <div className="state-stat-grid">
                    {STAT_FIELDS.map((stat) => (
                      <label className="field-label" htmlFor={`effect-${scenario.optionId}-${horizon}-${stat}`} key={stat}>{stat} (−20 to +20)
                        <input
                          id={`effect-${scenario.optionId}-${horizon}-${stat}`}
                          type="number"
                          min="-20"
                          max="20"
                          value={scenario.horizons[horizon][stat]}
                          onChange={(event) => updateScenario(scenario.optionId, (current) => ({
                            ...current,
                            horizons: {
                              ...current.horizons,
                              [horizon]: { ...current.horizons[horizon], [stat]: Number(event.target.value) },
                            },
                          }))}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <label className="field-label" htmlFor={`new-commitments-${scenario.optionId}`}>New commitments for this path
                <input id={`new-commitments-${scenario.optionId}`} value={scenario.newCommitments} onChange={(event) => updateScenario(scenario.optionId, (current) => ({ ...current, newCommitments: event.target.value }))} placeholder="New role, course" />
              </label>
              <label className="field-label" htmlFor={`ended-commitments-${scenario.optionId}`}>Commitments that end
                <input id={`ended-commitments-${scenario.optionId}`} value={scenario.endedCommitments} onChange={(event) => updateScenario(scenario.optionId, (current) => ({ ...current, endedCommitments: event.target.value }))} placeholder="Current role" />
              </label>
            </fieldset>
          ))}
        </details>
      </details>

      <fieldset className="form-section options-fieldset">
        <legend>Compare two options</legend>
        <div className="option-grid">
          <section className="option-fields" aria-labelledby="option-a-title">
            <h3 id="option-a-title"><span className="option-marker">A</span> Option A</h3>
            <label className="field-label" htmlFor="option-a-label">Option A label</label>
            <input
              id="option-a-label"
              name="optionALabel"
              type="text"
              value={values.optionALabel}
              onChange={(event) => updateValue("optionALabel", event.target.value)}
              placeholder="Graduate school"
              required
            />
            <label className="field-label" htmlFor="option-a-description">Option A description</label>
            <textarea
              id="option-a-description"
              name="optionADescription"
              rows={3}
              value={values.optionADescription}
              onChange={(event) => updateValue("optionADescription", event.target.value)}
              placeholder="Add context that would help describe this path."
            />
          </section>

          <section className="option-fields" aria-labelledby="option-b-title">
            <h3 id="option-b-title"><span className="option-marker option-marker-b">B</span> Option B</h3>
            <label className="field-label" htmlFor="option-b-label">Option B label</label>
            <input
              id="option-b-label"
              name="optionBLabel"
              type="text"
              value={values.optionBLabel}
              onChange={(event) => updateValue("optionBLabel", event.target.value)}
              placeholder="Move to a new city"
              required
            />
            <label className="field-label" htmlFor="option-b-description">Option B description</label>
            <textarea
              id="option-b-description"
              name="optionBDescription"
              rows={3}
              value={values.optionBDescription}
              onChange={(event) => updateValue("optionBDescription", event.target.value)}
              placeholder="Add context that would help describe this path."
            />
          </section>
        </div>
      </fieldset>

      <div className="form-section list-grid">
        <div>
          <label className="field-label" htmlFor="decision-goals">Goals</label>
          <input
            id="decision-goals"
            name="goals"
            type="text"
            value={values.goals}
            onChange={(event) => updateValue("goals", event.target.value)}
            placeholder="Career growth, meaningful work"
            aria-describedby="list-help"
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="decision-priorities">Priorities</label>
          <input
            id="decision-priorities"
            name="priorities"
            type="text"
            value={values.priorities}
            onChange={(event) => updateValue("priorities", event.target.value)}
            placeholder="Financial stability, community"
            aria-describedby="list-help"
            required
          />
        </div>
        <p className="field-help" id="list-help">Separate each item with a comma.</p>
      </div>

      <div className="form-section">
        <label className="field-label" htmlFor="decision-constraints">Other constraints <span>(optional)</span></label>
        <input
          id="decision-constraints"
          name="constraints"
          type="text"
          value={values.constraints}
          onChange={(event) => updateValue("constraints", event.target.value)}
          placeholder="Limited time, staying near family"
          aria-describedby="constraints-help"
        />
        <p className="field-help" id="constraints-help">Sent as <code>constraints.other</code>; separate items with commas.</p>
      </div>

      {validationMessage && <p className="inline-error" id="decision-validation-error" role="alert">{validationMessage}</p>}

      <button className="submit-button" type="submit" disabled={loading}>
        {loading ? <><span className="button-spinner" aria-hidden="true" /> Exploring both paths</> : <>Explore this decision <span aria-hidden="true">→</span></>}
      </button>
    </form>
  );
}

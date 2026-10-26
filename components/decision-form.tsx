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
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  function updateValue(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
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
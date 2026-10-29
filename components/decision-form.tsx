"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { DecisionInput } from "@/lib/schemas/decision";

interface DecisionFormProps {
  loading: boolean;
  onSubmit: (decision: DecisionInput) => void;
  initialData?: DecisionInput;
}

interface FormValues {
  question: string;
  optionALabel: string;
  optionADescription: string;
  optionBLabel: string;
  optionBDescription: string;
  goals: string[];
  priorities: string[];
  constraints: string[];
}

interface FieldErrors {
  question?: string;
  optionALabel?: string;
  optionBLabel?: string;
  goals?: string;
  priorities?: string;
  constraints?: string;
  duplicateLabels?: string;
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
  goals: [],
  priorities: [],
  constraints: [],
};

interface TagInputProps {
  id: string;
  label: string;
  placeholder: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  helpText?: string;
  error?: string;
  maxLength?: number;
  maxTags?: number;
  required?: boolean;
}

function TagInput({ id, label, placeholder, tags, onChange, helpText, error, maxLength = 200, maxTags = 20, required }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      const trimmed = inputValue.trim();
      if (trimmed && !tags.includes(trimmed) && tags.length < maxTags && trimmed.length <= maxLength) {
        onChange([...tags, trimmed]);
        setInputValue("");
      }
    } else if (event.key === "Backspace" && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label className="field-label" htmlFor={id}>{label} {required && <span aria-hidden="true">*</span>}</label>
      <div className="tag-input-container">
        <div className="tags-list">
          {tags.map((tag, index) => (
            <span key={index} className="tag">
              {tag}
              <button
                type="button"
                className="tag-remove"
                onClick={() => removeTag(index)}
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          id={id}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          maxLength={maxLength}
          disabled={tags.length >= maxTags}
        />
      </div>
      {helpText && <p className="field-help">{helpText}</p>}
      {error && <p className="inline-error">{error}</p>}
    </div>
  );
}

export default function DecisionForm({ loading, onSubmit, initialData }: DecisionFormProps) {
  const [values, setValues] = useState(initialData ? {
    question: initialData.question,
    optionALabel: initialData.options[0].label,
    optionADescription: initialData.options[0].description || "",
    optionBLabel: initialData.options[1].label,
    optionBDescription: initialData.options[1].description || "",
    goals: initialData.goals,
    priorities: initialData.priorities,
    constraints: Array.isArray(initialData.constraints) ? initialData.constraints : initialData.constraints.other || [],
  } : INITIAL_VALUES);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [currentStep, setCurrentStep] = useState(1);
  const TOTAL_STEPS = 4;

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

  function updateBaseline(field: keyof typeof baseline, value: string) {
    setBaseline((current) => ({ ...current, [field]: field === "age" || field === "year" || STAT_FIELDS.includes(field as StatField) ? Number(value) : value }));
  }

  function updateScenario(
    optionId: "A" | "B",
    update: (scenario: ScenarioFormValue) => ScenarioFormValue,
  ) {
    setScenarioValues((current) => current.map((scenario) => scenario.optionId === optionId ? update(scenario) : scenario));
  }

  function validateStep(step: number): boolean {
    const errors: FieldErrors = {};

    if (step === 1) {
      if (!values.question.trim()) {
        errors.question = "Question is required";
      } else if (values.question.trim().length > 1000) {
        errors.question = "Question must be 1,000 characters or less";
      }
    }

    if (step === 2) {
      if (!values.optionALabel.trim()) {
        errors.optionALabel = "Option A label is required";
      } else if (values.optionALabel.trim().length > 200) {
        errors.optionALabel = "Label must be 200 characters or less";
      }

      if (!values.optionBLabel.trim()) {
        errors.optionBLabel = "Option B label is required";
      } else if (values.optionBLabel.trim().length > 200) {
        errors.optionBLabel = "Label must be 200 characters or less";
      }

      if (values.optionALabel.trim() === values.optionBLabel.trim() && values.optionALabel.trim()) {
        errors.duplicateLabels = "Option labels must be different";
      }
    }

    if (step === 3) {
      if (!values.goals.length) {
        errors.goals = "At least one goal is required";
      } else if (values.goals.length > 20) {
        errors.goals = "Maximum 20 goals allowed";
      }

      if (!values.priorities.length) {
        errors.priorities = "At least one priority is required";
      } else if (values.priorities.length > 20) {
        errors.priorities = "Maximum 20 priorities allowed";
      }

      if (values.constraints.length > 20) {
        errors.constraints = "Maximum 20 constraints allowed";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleNext() {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
    }
  }

  function handleBack() {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }

  function handleTryExample() {
    setValues({
      question: "Should I pursue graduate school locally or move to a new city for work?",
      optionALabel: "Graduate school",
      optionADescription: "Pursue an advanced degree while staying near my current support network.",
      optionBLabel: "Move to a new city",
      optionBDescription: "Explore a new job market and build a new community.",
      goals: ["Build a meaningful career", "Feel engaged in daily life"],
      priorities: ["Learning", "Community"],
      constraints: ["Keep costs manageable", "Stay connected to family"],
    });
    setValidationMessage(null);
    setFieldErrors({});
  }

  function updateValue(field: keyof FormValues, value: string | string[]) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (validateStep(4)) {
      setValidationMessage(null);
      setFieldErrors({});
      onSubmit({
        question: values.question.trim(),
        options: [
          { id: "A", label: values.optionALabel.trim(), description: values.optionADescription.trim() || undefined },
          { id: "B", label: values.optionBLabel.trim(), description: values.optionBDescription.trim() || undefined },
        ],
        goals: values.goals,
        priorities: values.priorities,
        constraints: { other: values.constraints },
        baselineState: {
          character: { name: baseline.name.trim(), age: baseline.age, background: baseline.background.trim() || "Not specified" },
          year: baseline.year,
          stats: {
            finances: baseline.finances,
            wellbeing: baseline.wellbeing,
            health: baseline.health,
            career: baseline.career,
          },
          commitments: values.constraints.join(", "),
        },
        scenarioEffects: scenarioValues.map(({ optionId, horizons, newCommitments, endedCommitments }) => ({
          optionId,
          horizons,
          commitments: { new: newCommitments.split(",").map(s => s.trim()).filter(Boolean), ended: endedCommitments.split(",").map(s => s.trim()).filter(Boolean) },
        })),
      });
    }
  }

  return (
    <form className="decision-form decision-form-stepped" onSubmit={handleSubmit} aria-busy={loading} noValidate>
      <div className="progress-bar">
        <div className="progress-track">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`progress-step ${step <= currentStep ? "progress-step-active" : ""} ${step === currentStep ? "progress-step-current" : ""}`}
            >
              <span className="progress-number">{step}</span>
              <span className="progress-label">
                {step === 1 && "Your decision"}
                {step === 2 && "Two options"}
                {step === 3 && "What matters"}
                {step === 4 && "Review"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {currentStep === 1 && (
        <div className="form-step">
          <h3 className="step-title">What decision are you facing?</h3>
          <p className="step-description">Start with the question you're trying to answer.</p>
          <div className="form-section">
            <label className="field-label" htmlFor="decision-question">Your question</label>
            <input
              id="decision-question"
              name="question"
              type="text"
              value={values.question}
              onChange={(event) => updateValue("question", event.target.value)}
              placeholder="Should I go to graduate school or move to a new city?"
              maxLength={1000}
              required
            />
            {fieldErrors.question && <p className="inline-error">{fieldErrors.question}</p>}
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="form-step">
          <h3 className="step-title">Compare two options</h3>
          <p className="step-description">What are the two paths you're considering?</p>
          <fieldset className="form-section options-fieldset">
            <legend>Your options</legend>
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
                  maxLength={200}
                  required
                />
                {fieldErrors.optionALabel && <p className="inline-error">{fieldErrors.optionALabel}</p>}
                <label className="field-label" htmlFor="option-a-description">Option A description</label>
                <textarea
                  id="option-a-description"
                  name="optionADescription"
                  rows={3}
                  value={values.optionADescription}
                  onChange={(event) => updateValue("optionADescription", event.target.value)}
                  placeholder="Add context that would help describe this path."
                  maxLength={1000}
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
                  maxLength={200}
                  required
                />
                {fieldErrors.optionBLabel && <p className="inline-error">{fieldErrors.optionBLabel}</p>}
                <label className="field-label" htmlFor="option-b-description">Option B description</label>
                <textarea
                  id="option-b-description"
                  name="optionBDescription"
                  rows={3}
                  value={values.optionBDescription}
                  onChange={(event) => updateValue("optionBDescription", event.target.value)}
                  placeholder="Add context that would help describe this path."
                  maxLength={1000}
                />
              </section>
            </div>
          </fieldset>
          {fieldErrors.duplicateLabels && <p className="inline-error">{fieldErrors.duplicateLabels}</p>}
        </div>
      )}

      {currentStep === 3 && (
        <div className="form-step">
          <h3 className="step-title">What matters to you?</h3>
          <p className="step-description">Your goals, priorities, and any constraints you need to consider.</p>
          <div className="form-section list-grid">
            <TagInput
              id="decision-goals"
              label="Goals"
              placeholder="Career growth, meaningful work"
              tags={values.goals}
              onChange={(tags) => updateValue("goals", tags)}
              helpText="Type and press Enter to add each item. Max 200 chars per item, max 20 items."
              error={fieldErrors.goals}
              required
            />
            <TagInput
              id="decision-priorities"
              label="Priorities"
              placeholder="Financial stability, community"
              tags={values.priorities}
              onChange={(tags) => updateValue("priorities", tags)}
              helpText="Type and press Enter to add each item. Max 200 chars per item, max 20 items."
              error={fieldErrors.priorities}
              required
            />
          </div>

          <div className="form-section">
            <TagInput
              id="decision-constraints"
              label="Other constraints"
              placeholder="Limited time, staying near family"
              tags={values.constraints}
              onChange={(tags) => updateValue("constraints", tags)}
              helpText="Sent as constraints.other. Type and press Enter to add each item. Max 200 chars per item, max 20 items."
              error={fieldErrors.constraints}
            />
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="form-step">
          <h3 className="step-title">Review your decision</h3>
          <p className="step-description">Make sure everything looks correct before you explore the perspectives.</p>
          <div className="review-summary">
            <div className="review-section">
              <h4>Your question</h4>
              <p>{values.question || <em className="review-empty">Not provided</em>}</p>
            </div>
            <div className="review-section">
              <h4>Option A</h4>
              <p><strong>{values.optionALabel || <em className="review-empty">Not provided</em>}</strong></p>
              {values.optionADescription && <p className="review-description">{values.optionADescription}</p>}
            </div>
            <div className="review-section">
              <h4>Option B</h4>
              <p><strong>{values.optionBLabel || <em className="review-empty">Not provided</em>}</strong></p>
              {values.optionBDescription && <p className="review-description">{values.optionBDescription}</p>}
            </div>
            <div className="review-section">
              <h4>Goals</h4>
              <p>{values.goals.length > 0 ? values.goals.join(", ") : <em className="review-empty">Not provided</em>}</p>
            </div>
            <div className="review-section">
              <h4>Priorities</h4>
              <p>{values.priorities.length > 0 ? values.priorities.join(", ") : <em className="review-empty">Not provided</em>}</p>
            </div>
            {values.constraints.length > 0 && (
              <div className="review-section">
                <h4>Constraints</h4>
                <p>{values.constraints.join(", ")}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {validationMessage && <p className="inline-error" id="decision-validation-error" role="alert">{validationMessage}</p>}

      <div className="form-actions">
        {currentStep > 1 && (
          <button
            className="back-button"
            type="button"
            onClick={handleBack}
            disabled={loading}
          >
            ← Back
          </button>
        )}
        <button
          className="example-button"
          type="button"
          onClick={handleTryExample}
          disabled={loading}
        >
          Try an example
        </button>
        {currentStep < TOTAL_STEPS ? (
          <button
            className="next-button"
            type="button"
            onClick={handleNext}
            disabled={loading}
          >
            Next →
          </button>
        ) : (
          <button className="submit-button" type="submit" disabled={loading}>
            {loading ? <><span className="button-spinner" aria-hidden="true" /> Exploring both paths</> : <>Explore this decision <span aria-hidden="true">→</span></>}
          </button>
        )}
      </div>
    </form>
  );
}

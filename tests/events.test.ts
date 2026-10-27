import { describe, expect, it } from "vitest";
import { eventGenerator } from "@/lib/events/event-generator";
import { applyEventEffects, applyEventPayload, projectEventEffects, validatePayload } from "@/lib/events/engine";
import { AvatarStateSchema, type AvatarState } from "@/lib/events/state-schema";
import { validate_payload } from "@/lib/events/validation";
import type { GameState, LifeEventPayload, MutationTag, StatDelta, StatName } from "@/lib/events/types";
import { sampleDecision } from "@/tests/fixtures/decision";

const sampleState: AvatarState = {
  character: { name: "Alex", age: 28, background: "Software Engineer" },
  year: 2026,
  stats: { finances: 65, wellbeing: 70, health: 80, career: 60 },
  commitments: ["Current_Software_Engineer_Job", "Apartment_Lease"],
};

const sampleMutatingEvent: LifeEventPayload = {
  event_type: "CAREER_OFFER",
  mutation_tag: "BASELINE_MUTATING_EVENT",
  delta_justification: "An explicitly described promotion following an annual review.",
  horizon_years: 1,
  description: "Offered a senior engineer promotion.",
  proposed_effects: [
    { stat: "finances", delta: 15 },
    { stat: "wellbeing", delta: -5 },
    { stat: "career", delta: 10 },
  ],
  commitments: {
    new: ["Senior_Software_Engineer_Job"],
    ended: ["Current_Software_Engineer_Job"],
  },
};

describe("event payload validation", () => {
  it("accepts a complete event payload and exposes the requested validator name", () => {
    expect(validate_payload(sampleMutatingEvent)).toEqual([]);
    expect(validatePayload(sampleMutatingEvent)).toEqual([]);
  });

  it("reports missing fields and rejects invalid tags, stats, and out-of-range deltas", () => {
    expect(validate_payload({ event_type: "CAREER_OFFER" })).toEqual(
      expect.arrayContaining([expect.stringContaining("mutation_tag"), expect.stringContaining("commitments")]),
    );
    expect(validate_payload({
      ...sampleMutatingEvent,
      mutation_tag: "UNKNOWN",
      proposed_effects: [
        { stat: "happiness", delta: 1 },
        { stat: "health", delta: 21 },
      ],
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("mutation_tag"),
      expect.stringContaining("proposed_effects.0.stat"),
      expect.stringContaining("proposed_effects.1.delta"),
    ]));
  });

  it("requires the event horizon and disallows contradictory commitment changes", () => {
    const { horizon_years: _horizon, ...withoutHorizon } = sampleMutatingEvent;
    expect(validate_payload(withoutHorizon)).toEqual(
      expect.arrayContaining([expect.stringContaining("horizon_years")]),
    );
    expect(validate_payload({
      ...sampleMutatingEvent,
      commitments: { new: ["Same"], ended: ["Same"] },
    })).toEqual(expect.arrayContaining([expect.stringContaining("cannot be both new and ended")]));
  });
});

describe("event generator", () => {
  it("generates baseline-preserving alternatives at all three horizons", () => {
    const generated = eventGenerator.generateOptions(sampleDecision, sampleState);

    expect(generated).toHaveLength(2);
    for (const option of generated) {
      expect(Object.keys(option.events)).toEqual(["year1", "year5", "year10"]);
      expect(option.events.year1.horizon_years).toBe(1);
      expect(option.events.year5.horizon_years).toBe(5);
      expect(option.events.year10.horizon_years).toBe(10);
      expect(Object.values(option.events).every(({ mutation_tag }) => mutation_tag === "BASELINE_PRESERVING_OPTION")).toBe(true);
    }
  });

  it("classifies explicitly described events as baseline-mutating", () => {
    const event = eventGenerator.generateExplicitEvent({
      eventType: "CAREER_OFFER",
      cause: "An explicitly described promotion following an annual review.",
      description: "Offered a senior engineer promotion.",
      horizonYears: 1,
      proposedEffects: [{ stat: "career", delta: 10 }],
      commitments: { new: ["Senior_Software_Engineer_Job"], ended: ["Current_Software_Engineer_Job"] },
    });

    expect(event.mutation_tag).toBe("BASELINE_MUTATING_EVENT");
    expect(validate_payload(event)).toEqual([]);
  });

  it("builds a provider-ready prompt that includes the baseline and tag rules", () => {
    const prompt = eventGenerator.buildPrompt(sampleDecision, sampleState);
    expect(prompt).toContain("BASELINE_PRESERVING_OPTION");
    expect(prompt).toContain("BASELINE_MUTATING_EVENT");
    expect(prompt).toContain("Alex");
    expect(prompt).toContain(sampleDecision.question);
  });
});

describe("engine-side event application", () => {
  it("clamps stats, updates commitments, advances the horizon, and mutates only tagged events", () => {
    const state = {
      ...sampleState,
      stats: { ...sampleState.stats, finances: 95 },
    };
    const result = applyEventPayload(state, sampleMutatingEvent);

    expect(result.baselineState.year).toBe(2026);
    expect(result.projectedState.character.age).toBe(29);
    expect(result.projectedState.year).toBe(2027);
    expect(result.projectedState.stats).toEqual({
      finances: 100,
      wellbeing: 65,
      health: 80,
      career: 70,
    });
    expect(result.projectedState.commitments).toEqual([
      "Apartment_Lease",
      "Senior_Software_Engineer_Job",
    ]);
    expect(result.nextState).toEqual(result.projectedState);
    expect(state.year).toBe(2026);
    expect(state.stats.finances).toBe(95);
  });

  it("provides the blueprint engine API and mutates only baseline-mutating events", () => {
    const state: GameState = sampleState;
    const payload: LifeEventPayload = sampleMutatingEvent;
    const stat: StatName = "career";
    const delta: StatDelta = { stat, delta: 5 };
    const tag: MutationTag = payload.mutation_tag;
    expect(tag).toBe("BASELINE_MUTATING_EVENT");
    expect(delta).toEqual({ stat: "career", delta: 5 });

    const nextState = applyEventEffects(state, payload);
    expect(nextState.year).toBe(2027);
    expect(nextState.stats.finances).toBe(80);
    expect(nextState.stats.wellbeing).toBe(65);
    expect(nextState.stats.career).toBe(70);
  });

  it("keeps the active baseline unchanged for a hypothetical decision option", () => {
    const optionEvent = eventGenerator.generateOptions(sampleDecision, sampleState)[0].events.year5;
    const result = applyEventPayload(sampleState, optionEvent);
    const projection = projectEventEffects(sampleState, optionEvent);

    expect(result.projectedState.character.age).toBe(33);
    expect(result.projectedState.year).toBe(2031);
    expect(result.nextState).toEqual(sampleState);
    expect(result.baselineState).toEqual(sampleState);
    expect(projection).toEqual(result);
    expect(applyEventEffects(sampleState, optionEvent)).toEqual(sampleState);
  });

  it("rejects malformed baseline state", () => {
    expect(() => AvatarStateSchema.parse({
      ...sampleState,
      stats: { ...sampleState.stats, career: 101 },
    })).toThrow();
  });
});

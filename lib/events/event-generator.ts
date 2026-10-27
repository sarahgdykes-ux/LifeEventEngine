import type { DecisionInput, DecisionOption } from "@/lib/schemas/decision";
import { GeneratedOptionEventsSchema, EventPayloadSchema, type EventPayload, type GeneratedOptionEvents } from "@/lib/events/event-schema";
import { AvatarStateSchema, type AvatarState } from "@/lib/events/state-schema";
import { checkEventHandoff, generateCheckedEvent } from "@/lib/events/consistency-checker";

const HORIZONS = [
  { key: "year1", years: 1 },
  { key: "year5", years: 5 },
  { key: "year10", years: 10 },
] as const;

export interface ExplicitLifeEvent {
  eventType: string;
  cause: string;
  description: string;
  horizonYears: 1 | 5 | 10;
  proposedEffects: EventPayload["proposed_effects"];
  commitments: EventPayload["commitments"];
}

function optionEvent(
  option: DecisionOption,
  years: 1 | 5 | 10,
): EventPayload {
  const horizon = years === 1 ? "1 year" : `${years} years`;
  const event = {
    event_type: "DECISION_OPTION",
    mutation_tag: "BASELINE_PRESERVING_OPTION",
    delta_justification: "This is a hypothetical option branch. No state changes are inferred without supporting information.",
    horizon_years: years,
    description: `Explore "${option.label}" over ${horizon}; review progress against the goals and priorities supplied for this decision.`,
    proposed_effects: [],
    commitments: { new: [], ended: [] },
  };
  return EventPayloadSchema.parse(event);
}

export class EventGeneratorAgent {
  generateOptions(decision: DecisionInput, stateInput: unknown): GeneratedOptionEvents[] {
    const state = AvatarStateSchema.parse(stateInput);
    return decision.options.map((option) => GeneratedOptionEventsSchema.parse({
      optionId: option.id,
      events: Object.fromEntries(HORIZONS.map(({ key, years }) => {
        const payload = optionEvent(option, years);
        const check = checkEventHandoff(payload, state);
        if (!check.accepted) throw new Error(`Consistency Checker rejected generated option: ${check.reasons.join("; ")}`);
        return [key, payload];
      })),
    }));
  }

  generateExplicitEvent(event: ExplicitLifeEvent): EventPayload {
    return EventPayloadSchema.parse({
      event_type: event.eventType,
      mutation_tag: "BASELINE_MUTATING_EVENT",
      delta_justification: event.cause,
      horizon_years: event.horizonYears,
      description: event.description,
      proposed_effects: event.proposedEffects,
      commitments: event.commitments,
    });
  }

  async generateChecked<T>(
    generate: (correctionReasons?: readonly string[]) => Promise<unknown>,
    state: AvatarState,
    history: readonly EventPayload[] = [],
  ): Promise<T> {
    return generateCheckedEvent<T>(generate, state, history);
  }

  buildPrompt(decision: DecisionInput, stateInput: unknown): string {
    const state: AvatarState = AvatarStateSchema.parse(stateInput);
    return [
      "Generate structured life-decision scenario payloads using the supplied decision and baseline state.",
      "Return one payload for each option at each 1-, 5-, and 10-year horizon.",
      "Decision alternatives are BASELINE_PRESERVING_OPTION branches; do not mutate the source baseline or invent unsupported stat deltas.",
      "Use BASELINE_MUTATING_EVENT only for an explicitly described event with a stated cause in delta_justification.",
      "Every proposed stat delta must be an integer from -20 to 20; state stats are clamped to 0-100 when applied.",
      "Return JSON matching EventPayloadSchema exactly.",
      `Decision: ${JSON.stringify(decision)}`,
      `Baseline state: ${JSON.stringify(state)}`,
    ].join("\n");
  }
}

export const eventGenerator = new EventGeneratorAgent();

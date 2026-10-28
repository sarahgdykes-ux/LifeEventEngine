import type { DecisionInput, DecisionOption } from "@/lib/schemas/decision";
import { GeneratedOptionEventsSchema, EventPayloadSchema, type EventPayload, type GeneratedOptionEvents } from "@/lib/events/event-schema";
import { AvatarStateSchema, type AvatarState } from "@/lib/events/state-schema";
import { generateCheckedEvent } from "@/lib/events/consistency-checker";
import { generateStructuredAgentOutput } from "@/lib/llm/adapter";

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
  scenario?: NonNullable<DecisionInput["scenarioEffects"]>[number],
): EventPayload {
  const horizon = years === 1 ? "1 year" : `${years} years`;
  const horizonKey = years === 1 ? "year1" : years === 5 ? "year5" : "year10";
  const deltas = scenario?.horizons[horizonKey];
  const proposedEffects = deltas
    ? Object.entries(deltas).flatMap(([stat, delta]) => delta === 0 ? [] : [{ stat, delta }])
    : [];
  const hasEffects = proposedEffects.length > 0
    || Boolean(scenario?.commitments.new.length || scenario?.commitments.ended.length);
  const event = {
    event_type: "DECISION_OPTION",
    mutation_tag: "BASELINE_PRESERVING_OPTION",
    delta_justification: hasEffects
      ? "Effects are user-supplied scenario assumptions for exploration, not factual estimates or predictions."
      : "No stat or commitment changes were supplied for this hypothetical branch.",
    horizon_years: years,
    description: `Explore "${option.label}" over ${horizon}; review progress against the goals and priorities supplied for this decision.`,
    proposed_effects: proposedEffects,
    commitments: scenario?.commitments ?? { new: [], ended: [] },
  };
  return EventPayloadSchema.parse(event);
}

export class EventGeneratorAgent {
  generateOptions(decision: DecisionInput, stateInput: unknown): GeneratedOptionEvents[] {
    const state = AvatarStateSchema.parse(stateInput);
    return decision.options.map((option) => GeneratedOptionEventsSchema.parse({
      optionId: option.id,
      events: Object.fromEntries(HORIZONS.map(({ key, years }) => {
        const scenario = decision.scenarioEffects?.find(({ optionId }) => optionId === option.id);
        return [key, optionEvent(option, years, scenario)];
      })),
    }));
  }

  async generateOptionEvent(
    decision: DecisionInput,
    option: DecisionOption,
    stateInput: unknown,
    years: 1 | 5 | 10,
    correctionReasons?: readonly string[],
  ): Promise<EventPayload> {
    const state = AvatarStateSchema.parse(stateInput);
    const scenario = decision.scenarioEffects?.find(({ optionId }) => optionId === option.id);
    const supplied = optionEvent(option, years, scenario);
    let generated: EventPayload | undefined;
    try {
      generated = await generateStructuredAgentOutput({
        schema: EventPayloadSchema,
        systemPrompt: [
          "You are an event generator for a life decision simulator. Describe a plausible scenario checkpoint using only the decision, baseline, option, and user-supplied effects.",
          "Do not invent stat effects or commitments. The user-supplied assumptions are authoritative; describe their implications without turning them into factual predictions.",
          "Return one event payload for this horizon. Keep it a BASELINE_PRESERVING_OPTION branch.",
        ].join(" "),
        prompt: JSON.stringify({
          decision,
          option,
          baselineState: state,
          horizonYears: years,
          suppliedEffects: supplied.proposed_effects,
          suppliedCommitments: supplied.commitments,
          correctionReasons,
        }),
      });
    } catch {
      generated = undefined;
    }
    return EventPayloadSchema.parse({
      ...(generated ?? supplied),
      event_type: "DECISION_OPTION",
      mutation_tag: "BASELINE_PRESERVING_OPTION",
      horizon_years: years,
      proposed_effects: supplied.proposed_effects,
      commitments: supplied.commitments,
    });
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

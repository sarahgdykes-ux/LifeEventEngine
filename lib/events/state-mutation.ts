import { AvatarStateSchema, type AvatarState } from "@/lib/events/state-schema";
import { parseEventPayload } from "@/lib/events/validation";
import type { EventPayload } from "@/lib/events/event-schema";

export interface EventApplication {
  baselineState: AvatarState;
  projectedState: AvatarState;
  nextState: AvatarState;
}

function projectState(state: AvatarState, event: EventPayload): AvatarState {
  const stats = { ...state.stats };
  event.proposed_effects.forEach(({ stat, delta }) => {
    stats[stat] = Math.max(0, Math.min(100, stats[stat] + delta));
  });

  const ended = new Set(event.commitments.ended);
  const commitments = state.commitments.filter((commitment) => !ended.has(commitment));
  event.commitments.new.forEach((commitment) => {
    if (!commitments.includes(commitment)) commitments.push(commitment);
  });

  return AvatarStateSchema.parse({
    ...state,
    character: {
      ...state.character,
      age: state.character.age + event.horizon_years,
    },
    year: state.year + event.horizon_years,
    stats,
    commitments,
  });
}

export function applyEventPayload(stateInput: unknown, eventInput: unknown): EventApplication {
  const baselineState = AvatarStateSchema.parse(stateInput);
  const event = parseEventPayload(eventInput);
  const projectedState = projectState(baselineState, event);

  return {
    baselineState,
    projectedState,
    nextState: event.mutation_tag === "BASELINE_MUTATING_EVENT"
      ? projectedState
      : baselineState,
  };
}

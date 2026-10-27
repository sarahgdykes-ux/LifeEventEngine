import { applyEventPayload, type EventApplication } from "@/lib/events/state-mutation";
import type { GameState, LifeEventPayload } from "@/lib/events/types";
import { validate_payload, validatePayload } from "@/lib/events/validation";

export { validate_payload, validatePayload };
export { applyEventPayload };
export type { EventApplication };

export function applyEventEffects(
  currentState: GameState,
  payload: LifeEventPayload,
): GameState {
  return applyEventPayload(currentState, payload).nextState;
}

export function projectEventEffects(
  currentState: GameState,
  payload: LifeEventPayload,
): EventApplication {
  return applyEventPayload(currentState, payload);
}

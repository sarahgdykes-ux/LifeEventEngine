import { applyEventEffects, projectEventEffects } from "@/lib/events/engine";
import type { GameState, LifeEventPayload } from "@/lib/events/types";

export interface ConsequenceResult {
  candidateState: GameState;
  nextState: GameState;
  executionSummary: string;
}

/** Apply a validated event to a candidate state, returning the isolated projection and active next state. */
export function compute_effects(state: GameState, payload: LifeEventPayload): ConsequenceResult {
  const application = projectEventEffects(state, payload);
  const candidateState = application.projectedState;
  const nextState = applyEventEffects(state, payload);
  const changedStats = payload.proposed_effects.map(({ stat, delta }) => `${stat} ${delta >= 0 ? "+" : ""}${delta}`);
  const commitmentCount = payload.commitments.new.length + payload.commitments.ended.length;
  const summary = changedStats.length > 0 ? changedStats.join(", ") : "no stat changes";

  return {
    candidateState,
    nextState,
    executionSummary: `${payload.mutation_tag}: ${summary}; ${commitmentCount} commitment change(s); projected ${payload.horizon_years} year(s).`,
  };
}

export const computeEffects = compute_effects;

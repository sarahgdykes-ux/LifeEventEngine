import { validate_payload } from "@/lib/events/validation";
import { AvatarStateSchema } from "@/lib/events/state-schema";
import { EventPayloadSchema } from "@/lib/events/event-schema";
import type { GameState, LifeEventPayload } from "@/lib/events/types";
import { project_trajectory } from "@/lib/agents/balance-reviewer";

export interface EventCheck {
  accepted: boolean;
  reasons: string[];
}

/** Preflight payload and state checks for the Event Generator → Consistency Checker handoff. */
export function checkEventHandoff(
  payload: unknown,
  stateInput: unknown,
  history: readonly LifeEventPayload[] = [],
): EventCheck {
  const reasons = validate_payload(payload);
  const stateResult = AvatarStateSchema.safeParse(stateInput);
  if (!stateResult.success) {
    reasons.push(...stateResult.error.issues.map((issue) => `read_state.${issue.path.join(".")}: ${issue.message}`));
  }

  if (stateResult.success && payload && typeof payload === "object") {
    const event = payload as Partial<LifeEventPayload>;
    const commitments = event.commitments;
    if (event.mutation_tag === "BASELINE_PRESERVING_OPTION" && commitments) {
      if (commitments.new.some((item) => stateResult.data.commitments.includes(item)
        && !commitments.ended.includes(item))) {
        reasons.push("read_state.commitments: option repeats an already active commitment");
      }
    }

    if (reasons.length === 0) {
      const validEvent = EventPayloadSchema.parse(payload);
      const stats = { ...stateResult.data.stats };
      validEvent.proposed_effects.forEach(({ stat, delta }) => {
        stats[stat] = Math.max(0, Math.min(100, stats[stat] + delta));
      });
      const ended = new Set(validEvent.commitments.ended);
      const commitments = stateResult.data.commitments.filter((item) => !ended.has(item));
      validEvent.commitments.new.forEach((item) => {
        if (!commitments.includes(item)) commitments.push(item);
      });
      const projected = AvatarStateSchema.parse({
        ...stateResult.data,
        year: stateResult.data.year + validEvent.horizon_years,
        character: { ...stateResult.data.character, age: stateResult.data.character.age + validEvent.horizon_years },
        stats,
        commitments,
      });
      const review = project_trajectory([stateResult.data, projected]);
      if (review.status === "unwinnable") reasons.push(...review.flags.map((flag) => `balance_review: ${flag}`));
    }
  }

  if (payload && typeof payload === "object" && typeof (payload as Partial<LifeEventPayload>).event_type === "string") {
    const type = (payload as Partial<LifeEventPayload>).event_type;
    if (history.some((entry) => entry.event_type === type && entry.description === (payload as Partial<LifeEventPayload>).description)) {
      reasons.push("read_history: duplicate event already exists in the timeline");
    }
  }

  return { accepted: reasons.length === 0, reasons };
}

/** Pass checker rejection reasons back into a single bounded correction attempt. */
export async function generateCheckedEvent<T>(
  generate: (correctionReasons?: readonly string[]) => Promise<unknown>,
  state: GameState,
  history: readonly LifeEventPayload[] = [],
): Promise<T> {
  const first = await generate();
  const firstCheck = checkEventHandoff(first, state, history);
  if (firstCheck.accepted) return first as T;

  const corrected = await generate(firstCheck.reasons);
  const correctedCheck = checkEventHandoff(corrected, state, history);
  if (!correctedCheck.accepted) {
    throw new Error(`Consistency Checker rejected corrected event: ${correctedCheck.reasons.join("; ")}`);
  }
  return corrected as T;
}

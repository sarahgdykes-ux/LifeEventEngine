import type { OptionId } from "@/lib/agents/types";
import { compute_effects } from "@/lib/agents/consequence-simulator";
import { project_trajectory } from "@/lib/agents/balance-reviewer";
import { eventGenerator } from "@/lib/events/event-generator";
import { EventPayloadSchema, type EventPayload } from "@/lib/events/event-schema";
import { AvatarStateSchema, type AvatarState } from "@/lib/events/state-schema";
import type { DecisionInput } from "@/lib/schemas/decision";

export const STATE_HORIZONS = ["year1", "year5", "year10"] as const;
export type StateHorizon = (typeof STATE_HORIZONS)[number];

export interface HorizonProjection {
  event: EventPayload;
  state: AvatarState;
  executionSummary: string;
  correctionReasons: string[];
}

export interface OptionStateProjection {
  optionId: OptionId;
  horizons: Record<StateHorizon, HorizonProjection>;
  trajectoryReview: ReturnType<typeof project_trajectory>;
}

export interface DecisionStateProjection {
  baselineState: AvatarState;
  options: OptionStateProjection[];
}

const HORIZON_YEARS: Record<StateHorizon, 1 | 5 | 10> = {
  year1: 1,
  year5: 5,
  year10: 10,
};

function safeFallback(event: EventPayload, reasons: readonly string[]): EventPayload {
  return EventPayloadSchema.parse({
    ...event,
    delta_justification: `Safe unchanged-state fallback after checker rejection: ${reasons.join("; ")}`,
    proposed_effects: [],
    commitments: { new: [], ended: [] },
  });
}

/** Project each option and horizon independently from the same baseline. */
export async function projectDecisionState(decision: DecisionInput): Promise<DecisionStateProjection | undefined> {
  if (!decision.baselineState || !decision.scenarioEffects) return undefined;
  const baseline = AvatarStateSchema.parse(decision.baselineState);
  const generated = eventGenerator.generateOptions(decision, baseline);

  const options = await Promise.all(generated.map(async ({ optionId, events }) => {
    const history: EventPayload[] = [];
    const corrections: Partial<Record<StateHorizon, string[]>> = {};
    const checkedEvents = {} as Record<StateHorizon, EventPayload>;

    for (const horizon of STATE_HORIZONS) {
      const proposed = events[horizon];
      try {
        checkedEvents[horizon] = await eventGenerator.generateChecked<EventPayload>(async (reasons) => {
          if (!reasons) return proposed;
          corrections[horizon] = [...reasons];
          return safeFallback(proposed, reasons);
        }, baseline, history);
      } catch (error) {
        const reasons = error instanceof Error ? [error.message] : ["Consistency Checker rejected the event."];
        corrections[horizon] = reasons;
        checkedEvents[horizon] = safeFallback(proposed, reasons);
      }
      history.push(checkedEvents[horizon]);
    }

    const horizons = Object.fromEntries(STATE_HORIZONS.map((horizon) => {
      const result = compute_effects(baseline, checkedEvents[horizon]);
      return [horizon, {
        event: checkedEvents[horizon],
        state: result.candidateState,
        executionSummary: result.executionSummary,
        correctionReasons: corrections[horizon] ?? [],
      }];
    })) as Record<StateHorizon, HorizonProjection>;

    const trajectoryReview = project_trajectory(STATE_HORIZONS.map((horizon) => horizons[horizon].state));
    const correctionFlags = [...new Set(STATE_HORIZONS.flatMap((horizon) => corrections[horizon] ?? []))]
      .map((reason) => `Rejected proposed projection: ${reason}`);

    return {
      optionId,
      horizons,
      trajectoryReview: correctionFlags.length > 0
        ? { status: "at_risk" as const, flags: [...trajectoryReview.flags, ...correctionFlags] }
        : trajectoryReview,
    };
  }));

  return { baselineState: baseline, options };
}

export function deriveStateScores(projection: OptionStateProjection, baseline: AvatarState) {
  const finalState = projection.horizons.year10.state;
  const totalDownside = (["finances", "wellbeing", "health", "career"] as const)
    .reduce((sum, stat) => sum + Math.max(0, baseline.stats[stat] - finalState.stats[stat]), 0);
  const riskLevel = Math.min(100, Math.round(totalDownside / 4));

  return {
    financialHealth: {
      value: finalState.stats.finances,
      rationale: `Derived from the Year 10 projected finances value (${finalState.stats.finances}/100); this reflects supplied scenario assumptions, not a financial forecast.`,
    },
    emotionalWellbeing: {
      value: finalState.stats.wellbeing,
      rationale: `Derived from the Year 10 projected wellbeing value (${finalState.stats.wellbeing}/100); this reflects supplied scenario assumptions, not a clinical measure.`,
    },
    riskLevel: {
      value: riskLevel,
      rationale: `Computed as the average downside in finances, wellbeing, health, and career from baseline to Year 10 (${riskLevel}/100); this is a scenario indicator, not a probability.`,
    },
  };
}

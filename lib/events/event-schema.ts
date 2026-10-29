import { z } from "zod";
import { OptionIdSchema } from "@/lib/agents/types";

const RequiredTextSchema = z.string().trim().min(1);
const EventTypeSchema = z.string().trim().min(1).max(100).regex(
  /^[A-Z][A-Z0-9_]*$/,
  "Event type must be uppercase snake case",
);

export const MutationTagSchema = z.enum([
  "BASELINE_PRESERVING_OPTION",
  "BASELINE_MUTATING_EVENT",
]);

export const StatNameSchema = z.enum(["finances", "wellbeing", "health", "career"]);

export const ProposedEffectSchema = z.object({
  stat: StatNameSchema,
  delta: z.number().int().min(-20).max(20),
}).strict();

export const CommitmentsChangeSchema = z.object({
  new: z.array(RequiredTextSchema),
  ended: z.array(RequiredTextSchema),
}).strict().superRefine((commitments, context) => {
  if (new Set(commitments.new).size !== commitments.new.length) {
    context.addIssue({ code: "custom", message: "New commitments must be unique", path: ["new"] });
  }
  if (new Set(commitments.ended).size !== commitments.ended.length) {
    context.addIssue({ code: "custom", message: "Ended commitments must be unique", path: ["ended"] });
  }
  const newCommitments = new Set(commitments.new);
  commitments.ended.forEach((commitment, index) => {
    if (newCommitments.has(commitment)) {
      context.addIssue({
        code: "custom",
        message: "A commitment cannot be both new and ended",
        path: ["ended", index],
      });
    }
  });
});

export const EventPayloadSchema = z.object({
  event_type: EventTypeSchema,
  mutation_tag: MutationTagSchema,
  delta_justification: RequiredTextSchema,
  horizon_years: z.union([z.literal(1), z.literal(5), z.literal(10)]),
  description: RequiredTextSchema,
  proposed_effects: z.array(ProposedEffectSchema).max(4),
  commitments: CommitmentsChangeSchema,
}).strict().superRefine((payload, context) => {
  const stats = payload.proposed_effects.map(({ stat }) => stat);
  if (new Set(stats).size !== stats.length) {
    context.addIssue({
      code: "custom",
      message: "Each stat may have at most one proposed effect",
      path: ["proposed_effects"],
    });
  }
});

export const GeneratedOptionEventsSchema = z.object({
  optionId: OptionIdSchema,
  events: z.object({
    year1: EventPayloadSchema,
    year5: EventPayloadSchema,
    year10: EventPayloadSchema,
  }).strict(),
}).strict().superRefine((optionEvents, context) => {
  const expectedHorizons = { year1: 1, year5: 5, year10: 10 } as const;
  for (const [horizon, payload] of Object.entries(optionEvents.events) as [
    keyof typeof expectedHorizons,
    z.infer<typeof EventPayloadSchema>,
  ][]) {
    if (payload.horizon_years !== expectedHorizons[horizon]) {
      context.addIssue({
        code: "custom",
        message: `${horizon} event must use horizon_years=${expectedHorizons[horizon]}`,
        path: ["events", horizon, "horizon_years"],
      });
    }
    if (payload.mutation_tag !== "BASELINE_PRESERVING_OPTION") {
      context.addIssue({
        code: "custom",
        message: "Decision-option projections must preserve the baseline",
        path: ["events", horizon, "mutation_tag"],
      });
    }
  }
});

export type MutationTag = z.infer<typeof MutationTagSchema>;
export type ProposedEffect = z.infer<typeof ProposedEffectSchema>;
export type EventPayload = z.infer<typeof EventPayloadSchema>;
export type GeneratedOptionEvents = z.infer<typeof GeneratedOptionEventsSchema>;

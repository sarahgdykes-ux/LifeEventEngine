import type { z } from "zod";
import {
  AvatarStateSchema,
} from "@/lib/events/state-schema";
import {
  CommitmentsChangeSchema,
  EventPayloadSchema,
  MutationTagSchema,
  ProposedEffectSchema,
  StatNameSchema,
} from "@/lib/events/event-schema";

export type StatName = z.infer<typeof StatNameSchema>;
export type MutationTag = z.infer<typeof MutationTagSchema>;
export type StatDelta = z.infer<typeof ProposedEffectSchema>;
export type Commitments = z.infer<typeof CommitmentsChangeSchema>;
export type LifeEventPayload = z.infer<typeof EventPayloadSchema>;
export type GameState = z.infer<typeof AvatarStateSchema>;

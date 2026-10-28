import { z } from "zod";
import { OptionIdSchema } from "@/lib/agents/types";
import { AvatarStateSchema } from "@/lib/events/state-schema";
import { CommitmentsChangeSchema } from "@/lib/events/event-schema";

const RequiredTextSchema = z.string().trim().min(1, "Must not be empty");
const QuestionSchema = RequiredTextSchema.max(1_000);
const OptionLabelSchema = RequiredTextSchema.max(200);
const OptionDescriptionSchema = RequiredTextSchema.max(1_000);
const ListItemSchema = RequiredTextSchema.max(200);
const TextListSchema = z.array(ListItemSchema).max(20);
const NonEmptyTextListSchema = TextListSchema.min(1, "Must contain at least one item");
const ScenarioDeltaSchema = z.object({
  finances: z.number().int().min(-20).max(20),
  wellbeing: z.number().int().min(-20).max(20),
  health: z.number().int().min(-20).max(20),
  career: z.number().int().min(-20).max(20),
}).strict();
const OptionScenarioEffectsSchema = z.object({
  optionId: OptionIdSchema,
  horizons: z.object({
    year1: ScenarioDeltaSchema,
    year5: ScenarioDeltaSchema,
    year10: ScenarioDeltaSchema,
  }).strict(),
  commitments: CommitmentsChangeSchema,
}).strict();

export const DecisionOptionSchema = z.object({
  id: OptionIdSchema,
  label: OptionLabelSchema,
  description: OptionDescriptionSchema.optional(),
});

export const DecisionInputSchema = z.object({
  question: QuestionSchema,
  options: z
    .tuple([DecisionOptionSchema, DecisionOptionSchema])
    .refine(([first, second]) => first.id !== second.id, {
      message: "Options must use the distinct IDs A and B",
    })
    .refine(([first, second]) => [first.id, second.id].includes("A") && [first.id, second.id].includes("B"), {
      message: "Options must include IDs A and B",
    }),
  goals: NonEmptyTextListSchema,
  priorities: NonEmptyTextListSchema,
  constraints: z.union([
    TextListSchema,
    z.object({ other: TextListSchema }),
  ]),
  baselineState: AvatarStateSchema.optional(),
  scenarioEffects: z.array(OptionScenarioEffectsSchema).length(2).optional(),
}).superRefine((decision, context) => {
  if ((decision.baselineState === undefined) !== (decision.scenarioEffects === undefined)) {
    context.addIssue({
      code: "custom",
      message: "baselineState and scenarioEffects must be supplied together",
      path: [decision.baselineState === undefined ? "baselineState" : "scenarioEffects"],
    });
  }
  if (decision.baselineState && decision.baselineState.year > 9989) {
    context.addIssue({
      code: "custom",
      message: "Baseline year must leave room for the 10-year projection horizon",
      path: ["baselineState", "year"],
    });
  }
  if (decision.scenarioEffects && new Set(decision.scenarioEffects.map(({ optionId }) => optionId)).size !== 2) {
    context.addIssue({ code: "custom", message: "Scenario effects must include options A and B exactly once", path: ["scenarioEffects"] });
  }
});

export type DecisionOption = z.infer<typeof DecisionOptionSchema>;
export type DecisionInput = z.infer<typeof DecisionInputSchema>;

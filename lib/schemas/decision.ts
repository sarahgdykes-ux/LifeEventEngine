import { z } from "zod";
import { OptionIdSchema } from "@/lib/agents/types";

const RequiredTextSchema = z.string().trim().min(1, "Must not be empty");
const QuestionSchema = RequiredTextSchema.max(1_000);
const OptionLabelSchema = RequiredTextSchema.max(200);
const OptionDescriptionSchema = RequiredTextSchema.max(1_000);
const ListItemSchema = RequiredTextSchema.max(200);
const TextListSchema = z.array(ListItemSchema).max(20);
const NonEmptyTextListSchema = TextListSchema.min(1, "Must contain at least one item");

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
    })
    .refine(([first, second]) => first.label !== second.label, {
      message: "Option labels must be different",
    }),
  goals: NonEmptyTextListSchema,
  priorities: NonEmptyTextListSchema,
  constraints: z.union([
    TextListSchema,
    z.object({ other: TextListSchema }),
  ]),
});

export type DecisionOption = z.infer<typeof DecisionOptionSchema>;
export type DecisionInput = z.infer<typeof DecisionInputSchema>;
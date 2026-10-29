import { z } from "zod";

const RequiredTextSchema = z.string().trim().min(1);

export const AvatarStateSchema = z.object({
  character: z.object({
    name: RequiredTextSchema,
    age: z.number().int().min(0),
    background: RequiredTextSchema,
  }).strict(),
  year: z.number().int().min(0).max(9999),
  stats: z.object({
    finances: z.number().int().min(0).max(100),
    wellbeing: z.number().int().min(0).max(100),
    health: z.number().int().min(0).max(100),
    career: z.number().int().min(0).max(100),
  }).strict(),
  commitments: z.array(RequiredTextSchema),
}).strict().superRefine((state, context) => {
  if (new Set(state.commitments).size !== state.commitments.length) {
    context.addIssue({
      code: "custom",
      message: "Commitments must be unique",
      path: ["commitments"],
    });
  }
});

export type AvatarState = z.infer<typeof AvatarStateSchema>;

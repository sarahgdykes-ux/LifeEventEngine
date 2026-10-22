import { z } from "zod";

export const SimulationApiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

export type SimulationApiError = z.infer<typeof SimulationApiErrorSchema>;
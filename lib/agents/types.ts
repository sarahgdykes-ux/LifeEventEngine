import { z } from "zod";
import type { DecisionInput, DecisionOption } from "@/lib/schemas/decision";
import type { AgentResult } from "@/lib/schemas/simulation";

export const AGENT_NAMES = ["optimist", "pessimist", "financial", "wellbeing"] as const;
export const AgentNameSchema = z.enum(AGENT_NAMES);
export type AgentName = z.infer<typeof AgentNameSchema>;

export const OPTION_IDS = ["A", "B"] as const;
export const OptionIdSchema = z.enum(OPTION_IDS);
export type OptionId = z.infer<typeof OptionIdSchema>;

export const TIME_HORIZONS = ["year1", "year5", "year10"] as const;
export const TimeHorizonSchema = z.enum(TIME_HORIZONS);
export type TimeHorizon = z.infer<typeof TimeHorizonSchema>;

export const AGENT_EXECUTION_SOURCES = ["live_provider", "deterministic_fallback"] as const;
export const AgentExecutionSourceSchema = z.enum(AGENT_EXECUTION_SOURCES);
export type AgentExecutionSource = z.infer<typeof AgentExecutionSourceSchema>;

export interface SpecialistAgent {
  readonly name: AgentName;
  analyze(decision: DecisionInput, option: DecisionOption): Promise<AgentResult>;
  analyzeWithMetadata?(decision: DecisionInput, option: DecisionOption): Promise<{
    result: AgentResult;
    retriesUsed: number;
    source: AgentExecutionSource;
  }>;
}

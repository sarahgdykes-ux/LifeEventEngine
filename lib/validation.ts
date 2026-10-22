import { z } from "zod";
import { DecisionInputSchema, type DecisionInput } from "@/lib/schemas/decision";
import {
  AgentResultSchema,
  AgentResultsSchema,
  SimulationReportSchema,
  type AgentResult,
  type SimulationReport,
} from "@/lib/schemas/simulation";

export type DecisionInputValidation =
  | { success: true; data: DecisionInput }
  | { success: false; errors: string[] };

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "input";
    return `${path}: ${issue.message}`;
  });
}

export function validateDecisionInput(value: unknown): DecisionInputValidation {
  const parsed = DecisionInputSchema.safeParse(value);
  return parsed.success
    ? { success: true, data: parsed.data }
    : { success: false, errors: formatIssues(parsed.error) };
}

export function validateAgentResults(value: unknown): AgentResult[] {
  return AgentResultsSchema.parse(value);
}

export function validateAgentResult(value: unknown): AgentResult {
  return AgentResultSchema.parse(value);
}

export function validateSimulationReport(value: unknown): SimulationReport {
  return SimulationReportSchema.parse(value);
}
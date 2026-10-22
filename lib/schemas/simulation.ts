import { z } from "zod";
import {
  AGENT_NAMES,
  AgentNameSchema,
  OPTION_IDS,
  OptionIdSchema,
  TIME_HORIZONS,
} from "@/lib/agents/types";

const RequiredTextSchema = z.string().trim().min(1, "Must not be empty");
const TextListSchema = z.array(RequiredTextSchema).min(1, "Must contain at least one item");

export const AgentResultSchema = z.object({
  agent: AgentNameSchema,
  optionId: OptionIdSchema,
  findings: TextListSchema,
  assumptions: TextListSchema,
  confidence: z
    .number()
    .min(0)
    .max(100)
    .describe("Self-reported confidence in the analysis, not a probability that the scenario will occur."),
  uncertainties: TextListSchema,
  projections: z.object({
    year1: RequiredTextSchema,
    year5: RequiredTextSchema,
    year10: RequiredTextSchema,
  }),
  status: z.enum(["complete", "partial", "failed"]),
});

export type AgentResult = z.infer<typeof AgentResultSchema>;

export const AgentResultsSchema = z.array(AgentResultSchema).superRefine((results, context) => {
  const seen = new Set<string>();

  results.forEach((result, index) => {
    const identifier = `${result.agent}:${result.optionId}`;
    if (seen.has(identifier)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate agent-option result: ${identifier}`,
        path: [index],
      });
    }
    seen.add(identifier);
  });
});

export const MissingResultSchema = z.string().regex(
  /^(optimist|pessimist|financial|wellbeing):(A|B)$/,
  "Must identify an agent-option pair",
);

export const SimulationReportSchema = z
  .object({
    decisionId: RequiredTextSchema,
    results: AgentResultsSchema,
    reportStatus: z.enum(["complete", "partial", "failed"]),
    missingResults: z.array(MissingResultSchema),
  })
  .superRefine((report, context) => {
    const resultIds = new Set(report.results.map((result) => `${result.agent}:${result.optionId}`));
    const expectedMissing = AGENT_NAMES.flatMap((agent) => OPTION_IDS.map((optionId) => `${agent}:${optionId}`))
      .filter((identifier) => !resultIds.has(identifier));
    const reportedMissing = new Set(report.missingResults);

    if (reportedMissing.size !== report.missingResults.length) {
      context.addIssue({ code: "custom", message: "Missing result identifiers must be unique", path: ["missingResults"] });
    }
    if (expectedMissing.length !== reportedMissing.size || expectedMissing.some((identifier) => !reportedMissing.has(identifier))) {
      context.addIssue({
        code: "custom",
        message: "missingResults must list every absent agent-option result exactly once",
        path: ["missingResults"],
      });
    }
    if (report.reportStatus === "complete" && (expectedMissing.length > 0 || report.results.some((result) => result.status !== "complete"))) {
      context.addIssue({ code: "custom", message: "A complete report requires eight complete results", path: ["reportStatus"] });
    }
  });

export type SimulationReport = z.infer<typeof SimulationReportSchema>;
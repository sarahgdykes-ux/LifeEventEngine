import { z } from "zod";
import {
  AGENT_NAMES,
  AgentNameSchema,
  OPTION_IDS,
  OptionIdSchema,
  TIME_HORIZONS,
  type AgentName,
} from "@/lib/agents/types";

const RequiredTextSchema = z.string().trim().min(1, "Must not be empty");
const TextListSchema = z.array(RequiredTextSchema).min(1, "Must contain at least one item");

export const ScoreAssessmentSchema = z.object({
  value: z.number().int().min(0).max(100),
  rationale: RequiredTextSchema,
});

export const BreakdownScoresSchema = z.object({
  financialHealth: ScoreAssessmentSchema.optional(),
  emotionalWellbeing: ScoreAssessmentSchema.optional(),
  riskLevel: ScoreAssessmentSchema.optional(),
});

export const PerspectiveProjectionSchema = z.object({
  agent: AgentNameSchema,
  projection: RequiredTextSchema,
});

const HorizonPerspectivesSchema = z.array(PerspectiveProjectionSchema).length(AGENT_NAMES.length)
  .superRefine((perspectives, context) => {
    const names = new Set(perspectives.map(({ agent }) => agent));
    if (names.size !== AGENT_NAMES.length || AGENT_NAMES.some((agent) => !names.has(agent))) {
      context.addIssue({ code: "custom", message: "Each horizon must include all four perspectives" });
    }
  });

export const OptionSynthesisSchema = z.object({
  optionId: OptionIdSchema,
  timeline: z.object({
    year1: HorizonPerspectivesSchema,
    year5: HorizonPerspectivesSchema,
    year10: HorizonPerspectivesSchema,
  }),
  breakdownScores: z.object({
    financialHealth: ScoreAssessmentSchema,
    emotionalWellbeing: ScoreAssessmentSchema,
    riskLevel: ScoreAssessmentSchema,
  }),
});

export const SimulationSynthesisSchema = z.object({
  options: z.array(OptionSynthesisSchema).length(OPTION_IDS.length)
    .refine((options) => new Set(options.map(({ optionId }) => optionId)).size === OPTION_IDS.length, {
      message: "Synthesis must include both options exactly once",
    }),
});

export type OptionSynthesis = z.infer<typeof OptionSynthesisSchema>;
export type SimulationSynthesis = z.infer<typeof SimulationSynthesisSchema>;

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
  scores: BreakdownScoresSchema.default({}),
  status: z.enum(["complete", "partial", "failed"]),
}).superRefine((result, context) => {
  const missingScore = (result.agent === "financial" && result.scores.financialHealth === undefined)
    || (result.agent === "wellbeing" && result.scores.emotionalWellbeing === undefined)
    || (result.agent === "pessimist" && result.scores.riskLevel === undefined);
  if (missingScore) {
    context.addIssue({
      code: "custom",
      message: `${result.agent} result must include its required breakdown score`,
      path: ["scores"],
    });
  }
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
    synthesis: SimulationSynthesisSchema.nullable(),
    reportStatus: z.enum(["complete", "partial", "failed"]),
    missingResults: z.array(MissingResultSchema),
  })
  .superRefine((report, context) => {
    const completeResultIds = new Set(
      report.results
        .filter((result) => result.status === "complete")
        .map((result) => `${result.agent}:${result.optionId}`),
    );
    const expectedMissing = AGENT_NAMES.flatMap((agent) => OPTION_IDS.map((optionId) => `${agent}:${optionId}`))
      .filter((identifier) => !completeResultIds.has(identifier));
    const reportedMissing = new Set(report.missingResults);
    const completeResultCount = completeResultIds.size;

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
    if (report.reportStatus === "complete" && (expectedMissing.length > 0 || report.synthesis === null)) {
      context.addIssue({ code: "custom", message: "A complete report requires eight complete results and a synthesis", path: ["reportStatus"] });
    }
    if (report.reportStatus !== "complete" && report.synthesis !== null) {
      context.addIssue({ code: "custom", message: "Incomplete reports cannot include a synthesis", path: ["synthesis"] });
    }
    const expectedStatus = completeResultCount === AGENT_NAMES.length * OPTION_IDS.length
      ? "complete"
      : completeResultCount > 0
        ? "partial"
        : "failed";
    if (report.reportStatus !== expectedStatus) {
      context.addIssue({ code: "custom", message: `Report status must be ${expectedStatus} for the validated complete results`, path: ["reportStatus"] });
    }

    report.synthesis?.options.forEach((option, index) => {
      const hasScore = (agent: AgentName, scoreName: keyof AgentResult["scores"]) =>
        report.results.some((result) => result.agent === agent
          && result.optionId === option.optionId
          && result.scores[scoreName] !== undefined);

      if (!hasScore("financial", "financialHealth")) {
        context.addIssue({ code: "custom", message: "Financial result must provide the financial health score", path: ["synthesis", "options", index] });
      }
      if (!hasScore("wellbeing", "emotionalWellbeing")) {
        context.addIssue({ code: "custom", message: "Wellbeing result must provide the emotional wellbeing score", path: ["synthesis", "options", index] });
      }
      if (!hasScore("pessimist", "riskLevel")) {
        context.addIssue({ code: "custom", message: "Pessimist result must provide the risk level score", path: ["synthesis", "options", index] });
      }
    });
  });

export type SimulationReport = z.infer<typeof SimulationReportSchema>;
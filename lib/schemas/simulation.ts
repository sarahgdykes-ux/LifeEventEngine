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

export const AttributedFindingSchema = z.object({
  agent: AgentNameSchema,
  finding: RequiredTextSchema,
});

const TradeoffSchema = z.object({
  perspective: z.enum(["financial", "wellbeing", "opportunity", "risk"]),
  decisionQuestion: RequiredTextSchema,
  evidence: z.array(AttributedFindingSchema).min(1),
}).superRefine((tradeoff, context) => {
  const expectedAgent = {
    financial: "financial",
    wellbeing: "wellbeing",
    opportunity: "optimist",
    risk: "pessimist",
  }[tradeoff.perspective];
  tradeoff.evidence.forEach((finding, index) => {
    if (finding.agent !== expectedAgent) {
      context.addIssue({
        code: "custom",
        message: `${tradeoff.perspective} evidence must come from the ${expectedAgent} agent`,
        path: ["evidence", index, "agent"],
      });
    }
  });
});

const AgreementSchema = z.object({
  finding: RequiredTextSchema,
  agents: z.array(AgentNameSchema).min(2),
});

const DisagreementSchema = z.object({
  evidence: z.tuple([AttributedFindingSchema, AttributedFindingSchema]),
});

export const DecisionContextSchema = z.object({
  question: RequiredTextSchema,
  goals: TextListSchema,
  priorities: TextListSchema,
  constraints: z.array(RequiredTextSchema),
  options: z.array(z.object({
    optionId: OptionIdSchema,
    label: RequiredTextSchema,
    description: RequiredTextSchema.optional(),
  })).length(OPTION_IDS.length)
    .refine((options) => new Set(options.map(({ optionId }) => optionId)).size === OPTION_IDS.length, {
      message: "Decision context must include both options exactly once",
    }),
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
  strongestFindings: z.array(AttributedFindingSchema).length(AGENT_NAMES.length)
    .superRefine((findings, context) => {
      const agents = new Set(findings.map(({ agent }) => agent));
      if (agents.size !== AGENT_NAMES.length || AGENT_NAMES.some((agent) => !agents.has(agent))) {
        context.addIssue({ code: "custom", message: "Each option summary must include one finding from each specialist" });
      }
    }),
  tradeoffs: z.array(TradeoffSchema).length(4)
    .refine((tradeoffs) => new Set(tradeoffs.map(({ perspective }) => perspective)).size === 4, {
      message: "Each option summary must cover financial, wellbeing, opportunity, and risk perspectives",
    }),
  agreements: z.array(AgreementSchema),
  disagreements: z.array(DisagreementSchema),
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
  decisionContext: DecisionContextSchema,
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
      const hasSourceFinding = (agent: AgentName, finding: string) =>
        report.results.some((result) => result.agent === agent
          && result.optionId === option.optionId
          && result.findings.includes(finding));
      const hasScore = (agent: AgentName, scoreName: keyof AgentResult["scores"]) =>
        report.results.some((result) => result.agent === agent
          && result.optionId === option.optionId
          && result.scores[scoreName] !== undefined);

      option.strongestFindings.forEach(({ agent, finding }, findingIndex) => {
        const sourceResult = report.results.find((result) =>
          result.agent === agent && result.optionId === option.optionId,
        );
        if (!sourceResult || sourceResult.findings[0] !== finding) {
          context.addIssue({
            code: "custom",
            message: "Strongest findings must preserve the source agent's first finding exactly",
            path: ["synthesis", "options", index, "strongestFindings", findingIndex],
          });
        }
      });
      option.tradeoffs.forEach(({ evidence }, tradeoffIndex) => {
        evidence.forEach(({ agent, finding }, findingIndex) => {
          if (!hasSourceFinding(agent, finding)) {
            context.addIssue({
              code: "custom",
              message: "Trade-off evidence must match a source finding exactly",
              path: ["synthesis", "options", index, "tradeoffs", tradeoffIndex, "evidence", findingIndex],
            });
          }
        });
      });
      option.agreements.forEach(({ finding, agents }, agreementIndex) => {
        if (agents.some((agent) => !hasSourceFinding(agent, finding))) {
          context.addIssue({
            code: "custom",
            message: "Agreements must cite the same source finding from every named agent",
            path: ["synthesis", "options", index, "agreements", agreementIndex],
          });
        }
      });
      option.disagreements.forEach(({ evidence }, disagreementIndex) => {
        if (evidence[0].agent === evidence[1].agent
          || evidence.some(({ agent, finding }) => !hasSourceFinding(agent, finding))) {
          context.addIssue({
            code: "custom",
            message: "Disagreements must cite findings from two different source agents",
            path: ["synthesis", "options", index, "disagreements", disagreementIndex],
          });
        }
      });
      TIME_HORIZONS.forEach((horizon) => {
        option.timeline[horizon].forEach(({ agent, projection }, projectionIndex) => {
          const sourceResult = report.results.find((result) =>
            result.agent === agent && result.optionId === option.optionId,
          );
          if (!sourceResult || sourceResult.projections[horizon] !== projection) {
            context.addIssue({
              code: "custom",
              message: "Timeline projections must preserve source agent output exactly",
              path: ["synthesis", "options", index, "timeline", horizon, projectionIndex],
            });
          }
        });
      });

      if (!hasScore("financial", "financialHealth")) {
        context.addIssue({ code: "custom", message: "Financial result must provide the financial health score", path: ["synthesis", "options", index] });
      } else {
        const sourceScore = report.results.find((result) => result.agent === "financial" && result.optionId === option.optionId)?.scores.financialHealth;
        if (JSON.stringify(option.breakdownScores.financialHealth) !== JSON.stringify(sourceScore)) {
          context.addIssue({ code: "custom", message: "Financial score must preserve the source score exactly", path: ["synthesis", "options", index, "breakdownScores", "financialHealth"] });
        }
      }
      if (!hasScore("wellbeing", "emotionalWellbeing")) {
        context.addIssue({ code: "custom", message: "Wellbeing result must provide the emotional wellbeing score", path: ["synthesis", "options", index] });
      } else {
        const sourceScore = report.results.find((result) => result.agent === "wellbeing" && result.optionId === option.optionId)?.scores.emotionalWellbeing;
        if (JSON.stringify(option.breakdownScores.emotionalWellbeing) !== JSON.stringify(sourceScore)) {
          context.addIssue({ code: "custom", message: "Wellbeing score must preserve the source score exactly", path: ["synthesis", "options", index, "breakdownScores", "emotionalWellbeing"] });
        }
      }
      if (!hasScore("pessimist", "riskLevel")) {
        context.addIssue({ code: "custom", message: "Pessimist result must provide the risk level score", path: ["synthesis", "options", index] });
      } else {
        const sourceScore = report.results.find((result) => result.agent === "pessimist" && result.optionId === option.optionId)?.scores.riskLevel;
        if (JSON.stringify(option.breakdownScores.riskLevel) !== JSON.stringify(sourceScore)) {
          context.addIssue({ code: "custom", message: "Risk score must preserve the source score exactly", path: ["synthesis", "options", index, "breakdownScores", "riskLevel"] });
        }
      }
    });
  });

export type SimulationReport = z.infer<typeof SimulationReportSchema>;
import { AGENT_NAMES, OPTION_IDS, type AgentName } from "@/lib/agents/types";
import type { DecisionInput } from "@/lib/schemas/decision";
import {
  SimulationSynthesisSchema,
  type AgentResult,
  type SimulationSynthesis,
} from "@/lib/schemas/simulation";
import { validateCompleteAgentHandoff } from "@/lib/validation";

const HORIZONS = ["year1", "year5", "year10"] as const;
const NON_CONTENT_WORDS = new Set([
  "a", "an", "and", "are", "as", "be", "but", "by", "can", "could", "do", "does", "for", "from",
  "if", "in", "into", "is", "it", "may", "might", "not", "of", "on", "or", "should", "that", "the",
  "this", "to", "was", "were", "will", "with", "without", "would",
]);
const NEGATION = /\b(no|not|never|cannot|can't|doesn't|isn't|aren't|won't|without)\b/i;

function keyFor(agent: AgentName, optionId: DecisionInput["options"][number]["id"]): string {
  return `${agent}:${optionId}`;
}

function attributedFinding(agent: AgentName, finding: string) {
  return { agent, finding };
}

function normalizedContent(finding: string): string {
  return finding.toLowerCase().match(/[a-z0-9]+/g)
    ?.map((word) => word.length > 5 && word.endsWith("s") ? word.slice(0, -1) : word)
    .filter((word) => !NON_CONTENT_WORDS.has(word))
    .join(" ") ?? "";
}

function findAgreements(findings: ReturnType<typeof attributedFinding>[]) {
  const grouped = new Map<string, Set<AgentName>>();
  findings.forEach(({ agent, finding }) => {
    const key = finding.trim().toLowerCase().replace(/\s+/g, " ");
    const agents = grouped.get(key) ?? new Set<AgentName>();
    agents.add(agent);
    grouped.set(key, agents);
  });

  return [...grouped.entries()]
    .filter(([, agents]) => agents.size > 1)
    .map(([key, agents]) => ({
      finding: findings.find(({ finding }) => finding.trim().toLowerCase().replace(/\s+/g, " ") === key)!.finding,
      agents: AGENT_NAMES.filter((agent) => agents.has(agent)),
    }));
}

function findDirectDisagreements(findings: ReturnType<typeof attributedFinding>[]) {
  const disagreements: Array<{ evidence: [ReturnType<typeof attributedFinding>, ReturnType<typeof attributedFinding>] }> = [];

  for (let firstIndex = 0; firstIndex < findings.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < findings.length; secondIndex += 1) {
      const first = findings[firstIndex];
      const second = findings[secondIndex];
      if (first.agent === second.agent) continue;

      const firstContent = normalizedContent(first.finding);
      const secondContent = normalizedContent(second.finding);
      if (firstContent && firstContent === secondContent && NEGATION.test(first.finding) !== NEGATION.test(second.finding)) {
        disagreements.push({ evidence: [first, second] });
      }
    }
  }

  return disagreements;
}

export class Narrator {
  synthesize(results: AgentResult[], decision: DecisionInput): SimulationSynthesis {
    const completeResults = validateCompleteAgentHandoff(results);
    const resultsByKey = new Map(
      completeResults.map((result) => [keyFor(result.agent, result.optionId), result]),
    );
    const constraints = Array.isArray(decision.constraints)
      ? decision.constraints
      : decision.constraints.other;

    const synthesis = {
      decisionContext: {
        question: decision.question,
        goals: [...decision.goals],
        priorities: [...decision.priorities],
        constraints: [...constraints],
        options: decision.options.map(({ id, label, description }) => ({
          optionId: id,
          label,
          ...(description === undefined ? {} : { description }),
        })),
      },
      options: OPTION_IDS.map((optionId) => {
        const optionResults = AGENT_NAMES.map((agent) => {
          const result = resultsByKey.get(keyFor(agent, optionId));
          if (!result) throw new Error(`Narrator is missing validated result ${keyFor(agent, optionId)}`);
          return result;
        });
        const strongestFindings = optionResults.map((result) =>
          attributedFinding(result.agent, result.findings[0]),
        );
        const evidenceByAgent = new Map(optionResults.map((result) => [result.agent, result]));
        const financial = evidenceByAgent.get("financial");
        const wellbeing = evidenceByAgent.get("wellbeing");
        const optimist = evidenceByAgent.get("optimist");
        const pessimist = evidenceByAgent.get("pessimist");
        if (!financial || !wellbeing || !optimist || !pessimist) {
          throw new Error(`Narrator is missing a specialist perspective for option ${optionId}`);
        }

        const allFindings = optionResults.flatMap((result) =>
          result.findings.map((finding) => attributedFinding(result.agent, finding)),
        );
        const priorities = decision.priorities.join(", ");
        const goals = decision.goals.join(", ");
        const constraintsText = constraints.length > 0 ? constraints.join(", ") : "any constraints you choose to account for";
        const optionSynthesis = {
          optionId,
          strongestFindings,
          tradeoffs: [
            {
              perspective: "financial",
              decisionQuestion: `How do these financial considerations fit with your stated priorities: ${priorities}?`,
              evidence: financial.findings.map((finding) => attributedFinding("financial", finding)),
            },
            {
              perspective: "wellbeing",
              decisionQuestion: `How would you weigh these wellbeing considerations alongside other decision trade-offs for pursuing ${goals}?`,
              evidence: wellbeing.findings.map((finding) => attributedFinding("wellbeing", finding)),
            },
            {
              perspective: "opportunity",
              decisionQuestion: `Which opportunities described here would most directly support your stated goals: ${goals}?`,
              evidence: optimist.findings.map((finding) => attributedFinding("optimist", finding)),
            },
            {
              perspective: "risk",
              decisionQuestion: `Which uncertainties or fallback concerns matter most to you, given your constraints: ${constraintsText}?`,
              evidence: pessimist.findings.map((finding) => attributedFinding("pessimist", finding)),
            },
          ],
          agreements: findAgreements(allFindings),
          disagreements: findDirectDisagreements(allFindings),
          timeline: Object.fromEntries(HORIZONS.map((horizon) => [
            horizon,
            optionResults.map((result) => ({ agent: result.agent, projection: result.projections[horizon] })),
          ])),
          breakdownScores: {
            financialHealth: financial.scores.financialHealth,
            emotionalWellbeing: wellbeing.scores.emotionalWellbeing,
            riskLevel: pessimist.scores.riskLevel,
          },
        };

        return optionSynthesis;
      }),
    };

    return SimulationSynthesisSchema.parse(synthesis);
  }
}

export const narrator = new Narrator();

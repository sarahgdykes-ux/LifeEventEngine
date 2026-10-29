import type { DecisionInput, DecisionOption } from "@/lib/schemas/decision";
import type { AgentResult } from "@/lib/schemas/simulation";
import type { SpecialistAgent } from "@/lib/agents/types";
import { describeDecisionContext } from "@/lib/agents/context";
import { useLiveAgentExecution } from "@/lib/agents/live-agent";

export class OptimistAgent implements SpecialistAgent {
  readonly name = "optimist" as const;

  async analyze(decision: DecisionInput, option: DecisionOption): Promise<AgentResult> {
    return (await this.analyzeWithMetadata(decision, option)).result;
  }

  async analyzeWithMetadata(decision: DecisionInput, option: DecisionOption) {
    const context = describeDecisionContext(decision, option);
    const fallback: AgentResult = {
      agent: this.name,
      optionId: option.id,
      findings: [
        `Illustrative possibility: ${option.label} could create useful opportunities to pursue the decision's goals. This is a reflection prompt, not a factual prediction.`,
        `Use the shared starting-state assumptions as a progress baseline: ${context.baseline}`,
      ],
      assumptions: [
        `This scenario assumes the person can make a sustained effort toward ${option.label.toLowerCase()} while adapting as circumstances change.`,
      ],
      confidence: 50,
      uncertainties: [
        `Personal circumstances and external events could change how well ${option.label.toLowerCase()} fits the question: ${decision.question}`,
      ],
      projections: {
        year1: `Illustrative: early exploration of ${option.label.toLowerCase()} may clarify what feels energizing and what needs adjustment.`,
        year5: `Illustrative: continued commitment to ${option.label.toLowerCase()} could open new paths, while leaving room to revise the plan.`,
        year10: `Illustrative: the experience of ${option.label.toLowerCase()} may become one part of a changing life story rather than a fixed outcome.`,
      },
      scores: {},
      status: "complete",
    };
    return useLiveAgentExecution(this.name, decision, option, fallback);
  }
}

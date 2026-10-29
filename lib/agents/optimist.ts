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
        `Illustrative possibility: pursuing ${option.label} could create useful opportunities to advance the decision's goals. This is a reflection prompt, not a factual prediction.`,
        `Illustrative possibility: ${option.label} could create useful opportunities to pursue the decision's goals. This is a reflection prompt, not a factual prediction.`,
        `Use the shared starting-state assumptions as a progress baseline: ${context.baseline}`,
      ],
      assumptions: [
        `This scenario assumes the person can make a sustained effort toward this option while adapting as circumstances change.`,
      ],
      confidence: 50,
      uncertainties: [
        `Personal circumstances and external events could change how well this option fits the question: ${decision.question}`,
      ],
      projections: {
        year1: `Illustrative: early exploration of this option may clarify what feels energizing and what needs adjustment.`,
        year5: `Illustrative: continued commitment to this option could open new paths, while leaving room to revise the plan.`,
        year10: `Illustrative: the experience of this option may become one part of a changing life story rather than a fixed outcome.`,
      },
      scores: {},
      status: "complete",
    };
    return useLiveAgentExecution(this.name, decision, option, fallback);
  }
}

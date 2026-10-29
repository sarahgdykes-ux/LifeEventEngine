import { AvatarStateSchema, type AvatarState } from "@/lib/events/state-schema";

export interface TrajectoryReview {
  status: "viable" | "at_risk" | "unwinnable";
  flags: string[];
}

/** Review chronologically ordered projected states for persistent depletion or an unrecoverable health floor. */
export function project_trajectory(statesInput: readonly unknown[]): TrajectoryReview {
  const states = statesInput.map((state) => AvatarStateSchema.parse(state)) as AvatarState[];
  const flags: string[] = [];
  const final = states.at(-1);
  if (!final) return { status: "viable", flags };

  if (final.stats.health === 0) {
    flags.push("Health reaches 0 by the end of the projected trajectory.");
    if (states.every((state) => state.stats.health === 0 || state.stats.health <= (states[0]?.stats.health ?? 100))) {
      flags.push("No recovery appears in the supplied trajectory; review the assumptions or add a recovery path.");
      return { status: "unwinnable", flags };
    }
  }

  for (const stat of ["finances", "wellbeing", "health", "career"] as const) {
    const values = states.map((state) => state.stats[stat]);
    if (values.length >= 3 && values.at(-1)! < 20 && values.every((value, index) => index === 0 || value <= values[index - 1])) {
      flags.push(`${stat} declines at every supplied checkpoint and ends below 20.`);
    }
  }

  return { status: flags.length ? "at_risk" : "viable", flags };
}

export const projectTrajectory = project_trajectory;

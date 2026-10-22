import { runSimulation } from "@/lib/orchestrator";
import { validateDecisionInput } from "@/lib/validation";

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const validation = validateDecisionInput(payload);
  if (!validation.success) {
    return Response.json(
      { error: "Invalid decision input", details: validation.errors },
      { status: 400 },
    );
  }

  try {
    const report = await runSimulation(validation.data);
    return Response.json(report, { status: 200 });
  } catch {
    return Response.json({ error: "Simulation could not be completed" }, { status: 500 });
  }
}
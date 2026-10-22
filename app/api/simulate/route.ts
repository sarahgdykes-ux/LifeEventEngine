import { runSimulation } from "@/lib/orchestrator";
import type { SimulationApiError } from "@/lib/schemas/api";
import { validateDecisionInput } from "@/lib/validation";

function errorResponse(code: string, message: string, status: number): Response {
  const body: SimulationApiError = { error: { code, message } };
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return errorResponse("INVALID_REQUEST", "Request body must be valid JSON.", 400);
  }

  const validation = validateDecisionInput(payload);
  if (!validation.success) {
    return errorResponse("INVALID_REQUEST", "Request body does not match DecisionInput.", 400);
  }

  try {
    const report = await runSimulation(validation.data);
    console.info("Simulation request completed", {
      decisionId: report.decisionId,
      reportStatus: report.reportStatus,
      validatedResultCount: report.results.length,
    });
    return Response.json(report, { status: 200 });
  } catch (error) {
    console.error("Simulation request failed", {
      failureType: error instanceof Error ? error.name : "unknown_error",
    });
    return errorResponse("INTERNAL_ERROR", "Simulation could not be completed.", 500);
  }
}
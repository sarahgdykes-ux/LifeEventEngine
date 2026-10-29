import { runSimulation } from "@/lib/orchestrator";
import type { SimulationApiError } from "@/lib/schemas/api";
import { validateDecisionInput, validateSimulationReport } from "@/lib/validation";

const MAX_REQUEST_BODY_BYTES = 32 * 1024;

function errorResponse(code: string, message: string, status: number): Response {
  const body: SimulationApiError = { error: { code, message } };
  return Response.json(body, { status });
}

async function readRequestBody(request: Request): Promise<string | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_REQUEST_BODY_BYTES) {
    return null;
  }

  const reader = request.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let body = "";
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      byteLength += value.byteLength;
      if (byteLength > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: string | null;

  try {
    body = await readRequestBody(request);
  } catch {
    return errorResponse("INVALID_REQUEST", "Request body could not be read.", 400);
  }
  if (body === null) {
    return errorResponse("INVALID_REQUEST", "Request body exceeds the 32 KB limit.", 413);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return errorResponse("INVALID_REQUEST", "Request body must be valid JSON.", 400);
  }

  const validation = validateDecisionInput(payload);
  if (!validation.success) {
    return errorResponse("INVALID_REQUEST", "Request body does not match DecisionInput.", 400);
  }

  try {
    const report = validateSimulationReport(await runSimulation(validation.data));
    return Response.json(report, { status: 200 });
  } catch (error) {
    console.error("Simulation request failed", {
      failureType: error instanceof Error ? error.name : "unknown_error",
    });
    return errorResponse("INTERNAL_ERROR", "Simulation could not be completed.", 500);
  }
}
import { EventPayloadSchema, type EventPayload } from "@/lib/events/event-schema";

export function validate_payload(payload: unknown): string[] {
  const result = EventPayloadSchema.safeParse(payload);
  if (result.success) return [];

  return result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "payload";
    return `${path}: ${issue.message}`;
  });
}

export function validatePayload(payload: unknown): string[] {
  return validate_payload(payload);
}

export function parseEventPayload(payload: unknown): EventPayload {
  const errors = validate_payload(payload);
  if (errors.length > 0) {
    throw new Error(`Invalid event payload: ${errors.join("; ")}`);
  }
  return EventPayloadSchema.parse(payload);
}

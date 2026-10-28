import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { ZodError, type z } from "zod";

export type LLMProvider = "openai" | "gemini" | "anthropic" | "mock";

export interface StructuredOutputResult<T> {
  data: T;
  retriesUsed: number;
}

const DEFAULT_OUTPUT_RETRIES = 2;
const MAX_OUTPUT_RETRIES = 3;

function formatSchemaFeedback(error: z.ZodError): string {
  return error.issues
    .slice(0, 10)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "output";
      return `- ${path}: ${issue.message}`;
    })
    .join("\n");
}

function recoveryPrompt(prompt: string, feedback: string): string {
  return [
    prompt,
    "",
    "[SCHEMA RECOVERY NOTICE]",
    "The previous structured output did not satisfy the required schema. Regenerate the complete response, correcting these issues:",
    feedback,
  ].join("\n");
}

export async function generateWithSchemaRetries<T>({
  prompt,
  schema,
  generateAttempt,
  maxRetries = DEFAULT_OUTPUT_RETRIES,
}: {
  prompt: string;
  schema: z.ZodType<T>;
  generateAttempt: (attemptPrompt: string) => Promise<unknown>;
  maxRetries?: number;
}): Promise<StructuredOutputResult<T>> {
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > MAX_OUTPUT_RETRIES) {
    throw new RangeError(`maxRetries must be an integer between 0 and ${MAX_OUTPUT_RETRIES}`);
  }

  let attemptPrompt = prompt;
  for (let retriesUsed = 0; retriesUsed <= maxRetries; retriesUsed += 1) {
    let output: unknown;
    try {
      output = await generateAttempt(attemptPrompt);
    } catch (error) {
      if (retriesUsed === maxRetries) throw error;
      const feedback = error instanceof ZodError
        ? formatSchemaFeedback(error)
        : "The response could not be generated as valid structured output. Return a complete response matching the requested schema.";
      attemptPrompt = recoveryPrompt(prompt, feedback);
      continue;
    }

    const parsed = schema.safeParse(output);
    if (parsed.success) return { data: parsed.data, retriesUsed };
    if (retriesUsed === maxRetries) {
      throw new Error(`Structured output failed schema validation after ${maxRetries} retries.`);
    }

    attemptPrompt = recoveryPrompt(prompt, formatSchemaFeedback(parsed.error));
  }

  throw new Error("Unexpected exit from structured output retry loop.");
}

export function getLLMProvider(): LLMProvider {
  const configured = process.env.LLM_PROVIDER?.trim().toLowerCase();
  return configured === "openai" || configured === "gemini" || configured === "anthropic"
    ? configured
    : "mock";
}

export function isLiveLLMConfigured(): boolean {
  const provider = getLLMProvider();
  return (provider === "openai" && Boolean(process.env.OPENAI_API_KEY))
    || (provider === "gemini" && Boolean(process.env.GEMINI_API_KEY))
    || (provider === "anthropic" && Boolean(process.env.ANTHROPIC_API_KEY));
}

export async function generateStructuredAgentOutput<T>({
  prompt,
  schema,
  systemPrompt,
  maxRetries = DEFAULT_OUTPUT_RETRIES,
}: {
  prompt: string;
  schema: z.ZodType<T>;
  systemPrompt: string;
  maxRetries?: number;
}): Promise<T | undefined> {
  const provider = getLLMProvider();
  if (provider === "mock" || !isLiveLLMConfigured()) return undefined;

  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > MAX_OUTPUT_RETRIES) {
    throw new RangeError(`maxRetries must be an integer between 0 and ${MAX_OUTPUT_RETRIES}`);
  }

  const model = provider === "openai"
    ? openai(process.env.OPENAI_MODEL || "gpt-4o-mini")
    : provider === "gemini"
      ? google(process.env.GEMINI_MODEL || "gemini-2.5-flash")
      : anthropic(process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6");

  const result = await generateWithSchemaRetries({
    prompt,
    schema,
    maxRetries,
    generateAttempt: async (attemptPrompt) => {
      const { output } = await generateText({
        model,
        system: systemPrompt,
        prompt: attemptPrompt,
        output: Output.object({ schema }),
        maxRetries: 0,
      });
      return output;
    },
  });
  return result.data;
}

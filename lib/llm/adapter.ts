import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { z } from "zod";

export type LLMProvider = "openai" | "gemini" | "anthropic" | "mock";

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
}: {
  prompt: string;
  schema: z.ZodType<T>;
  systemPrompt: string;
}): Promise<T | undefined> {
  const provider = getLLMProvider();
  if (provider === "mock" || !isLiveLLMConfigured()) return undefined;

  const model = provider === "openai"
    ? openai(process.env.OPENAI_MODEL || "gpt-4o-mini")
    : provider === "gemini"
      ? google(process.env.GEMINI_MODEL || "gemini-2.5-flash")
      : anthropic(process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6");

  const { output } = await generateText({
    model,
    system: systemPrompt,
    prompt,
    output: Output.object({ schema }),
    maxRetries: 1,
  });
  return schema.parse(output);
}

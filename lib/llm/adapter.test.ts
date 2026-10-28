import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  generateWithSchemaRetries,
  getLLMProvider,
  isLiveLLMConfigured,
} from "@/lib/llm/adapter";

const ResponseSchema = z.object({
  summary: z.string().min(1),
  confidence: z.number().min(0).max(100),
});

describe("LLM provider configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses mock mode by default and for unknown providers", () => {
    vi.stubEnv("LLM_PROVIDER", "");
    expect(getLLMProvider()).toBe("mock");
    vi.stubEnv("LLM_PROVIDER", "unknown");
    expect(getLLMProvider()).toBe("mock");
  });

  it.each(["openai", "gemini", "anthropic"] as const)("recognizes %s", (provider) => {
    vi.stubEnv("LLM_PROVIDER", provider);
    expect(getLLMProvider()).toBe(provider);
  });

  it("requires the selected provider's matching key", () => {
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(isLiveLLMConfigured()).toBe(false);
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    expect(isLiveLLMConfigured()).toBe(true);
  });
});

describe("bounded structured-output retries", () => {
  it("retries schema-invalid output and feeds schema errors into the next prompt", async () => {
    const prompts: string[] = [];
    const generateAttempt = vi.fn(async (prompt: string) => {
      prompts.push(prompt);
      return prompts.length === 1
        ? { summary: "", confidence: 101 }
        : { summary: "A cautious scenario", confidence: 40 };
    });

    const result = await generateWithSchemaRetries({
      prompt: "Generate a scenario.",
      schema: ResponseSchema,
      generateAttempt,
    });

    expect(result).toEqual({
      data: { summary: "A cautious scenario", confidence: 40 },
      retriesUsed: 1,
    });
    expect(generateAttempt).toHaveBeenCalledTimes(2);
    expect(prompts[1]).toContain("summary");
    expect(prompts[1]).toContain("confidence");
    expect(prompts[1]).toContain("[SCHEMA RECOVERY NOTICE]");
    expect(prompts[1]).toContain("Generate a scenario.");
  });

  it("stops after the configured retry count and reports a safe validation failure", async () => {
    const generateAttempt = vi.fn(async () => ({ summary: "", confidence: -1 }));

    await expect(generateWithSchemaRetries({
      prompt: "Generate a scenario.",
      schema: ResponseSchema,
      generateAttempt,
      maxRetries: 2,
    })).rejects.toThrow("Structured output failed schema validation after 2 retries.");

    expect(generateAttempt).toHaveBeenCalledTimes(3);
  });

  it("supports disabling output retries", async () => {
    const generateAttempt = vi.fn(async () => ({ summary: "", confidence: 40 }));

    await expect(generateWithSchemaRetries({
      prompt: "Generate a scenario.",
      schema: ResponseSchema,
      generateAttempt,
      maxRetries: 0,
    })).rejects.toThrow("Structured output failed schema validation after 0 retries.");

    expect(generateAttempt).toHaveBeenCalledTimes(1);
  });

  it("retries generation errors with a generic safe recovery notice", async () => {
    const prompts: string[] = [];
    const generateAttempt = vi.fn(async (prompt: string) => {
      prompts.push(prompt);
      if (prompts.length === 1) throw new Error("provider response included private content");
      return { summary: "Recovered output", confidence: 55 };
    });

    const result = await generateWithSchemaRetries({
      prompt: "Generate a scenario.",
      schema: ResponseSchema,
      generateAttempt,
    });

    expect(result.retriesUsed).toBe(1);
    expect(prompts[1]).toContain("could not be generated as valid structured output");
    expect(prompts[1]).not.toContain("private content");
  });

  it("rejects retry limits outside the bounded range", async () => {
    await expect(generateWithSchemaRetries({
      prompt: "Generate a scenario.",
      schema: ResponseSchema,
      generateAttempt: vi.fn(),
      maxRetries: 4,
    })).rejects.toThrow("maxRetries must be an integer between 0 and 3");
  });
});

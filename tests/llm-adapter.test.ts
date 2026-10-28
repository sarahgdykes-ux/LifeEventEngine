import { afterEach, describe, expect, it, vi } from "vitest";
import { getLLMProvider, isLiveLLMConfigured } from "@/lib/llm/adapter";

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

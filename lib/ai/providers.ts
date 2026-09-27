export const AI_PROVIDERS = {
  openai: {
    id: "openai",
    name: "ChatGPT",
    implemented: true,
    models: [
      "gpt-6-astra",
      "gpt-6-sol",
      "gpt-6-luna",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
      "gpt-5",
      "gpt-5-mini",
      "gpt-5-nano",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4o",
      "gpt-4o-mini",
    ],
    defaultModel: "gpt-6-luna",
  },
  claude: {
    id: "claude",
    name: "Claude",
    implemented: true,
    models: [
      "claude-fable-5-1",
      "claude-opus-5-5",
      "claude-sonnet-5",
      "claude-haiku-4-5",
      "claude-fable-5",
      "claude-opus-5",
      "claude-opus-4-8",
      "claude-opus-4-7",
      "claude-opus-4-6",
      "claude-opus-4-5",
      "claude-sonnet-4-6",
      "claude-sonnet-4-5",
    ],
    defaultModel: "claude-sonnet-5",
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    implemented: true,
    models: [
      "deepseek-flash",
      "deepseek-v4-pro",
    ],
    defaultModel: "deepseek-flash",
  },
  perplexity: {
    id: "perplexity",
    name: "Perplexity",
    implemented: true,
    models: [
      "sonar",
      "sonar-pro",
      "sonar-reasoning-pro",
      "sonar-deep-research",
    ],
    defaultModel: "sonar",
  },
} as const;

export type AiProviderId = keyof typeof AI_PROVIDERS;

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === "string" && value in AI_PROVIDERS;
}

export function providerModels(provider: AiProviderId) {
  return AI_PROVIDERS[provider].models as readonly string[];
}

export function defaultModel(provider: AiProviderId) {
  return AI_PROVIDERS[provider].defaultModel;
}

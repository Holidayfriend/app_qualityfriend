export const AI_PROVIDERS = {
  openai: {
    id: "openai",
    name: "ChatGPT",
    implemented: true,
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"],
    defaultModel: "gpt-4o-mini",
  },
  claude: {
    id: "claude",
    name: "Claude",
    implemented: true,
    models: ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-5"],
    defaultModel: "claude-sonnet-4-5",
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

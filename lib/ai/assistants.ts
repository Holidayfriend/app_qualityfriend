export const ASSISTANT_KEYS = ["general", "handover", "review", "budget", "recruiting", "manuals", "schedule"] as const;
export type AssistantKey = (typeof ASSISTANT_KEYS)[number];

export function isAssistantKey(value: unknown): value is AssistantKey {
  return typeof value === "string" && (ASSISTANT_KEYS as readonly string[]).includes(value);
}

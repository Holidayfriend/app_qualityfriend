import en from "./locales/en.json";
import de from "./locales/de.json";
import it from "./locales/it.json";

export const repairsMessages = {
  en: en.repairsMessages,
  de: de.repairsMessages,
  it: it.repairsMessages,
} as const;

export type RepairsMessages = typeof repairsMessages.en;

export function getRepairsMessages(locale: keyof typeof repairsMessages) {
  return repairsMessages[locale] ?? repairsMessages.en;
}

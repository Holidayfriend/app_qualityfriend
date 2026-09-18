import en from "./locales/en.json";
import de from "./locales/de.json";
import it from "./locales/it.json";

export const handoversMessages = {
  en: en.handoversMessages,
  de: de.handoversMessages,
  it: it.handoversMessages,
} as const;

export type HandoversMessages = typeof handoversMessages.en;

export function getHandoversMessages(locale: keyof typeof handoversMessages) {
  return handoversMessages[locale] ?? handoversMessages.en;
}

import en from "./locales/en.json";
import de from "./locales/de.json";
import it from "./locales/it.json";

export const forecastMessages = {
  en: en.forecastMessages,
  de: de.forecastMessages,
  it: it.forecastMessages,
} as const;

export type ForecastMessages = typeof forecastMessages.en;

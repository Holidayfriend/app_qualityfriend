import en from "./locales/en.json";
import de from "./locales/de.json";
import it from "./locales/it.json";

export const supportedLocales = ["en", "de", "it"] as const;
export type Locale = (typeof supportedLocales)[number];

const catalogs = { en, de, it } as const;

export const dictionaries = {
  en: en.dictionary,
  de: de.dictionary,
  it: it.dictionary,
} as const;

export const requestMessages = byLocale("requestMessages");
export const auditMessages = byLocale("auditMessages");
export const settingsPageMessages = byLocale("settingsPageMessages");
export const recycleBinMessages = byLocale("recycleBinMessages");
export const hotelLanguageMessages = byLocale("hotelLanguageMessages");
export const roleMessages = byLocale("roleMessages");
export const clientRoleMessages = byLocale("clientRoleMessages");
export const roleLevelNames = byLocale("roleLevelNames");
export const additionalModuleMessages = byLocale("additionalModuleMessages");
export const userManagementMessages = byLocale("userManagementMessages");
export const moduleNavigationMessages = byLocale("moduleNavigationMessages");
export const accessDeniedMessages = byLocale("accessDeniedMessages");
export const mcpSettingsMessages = byLocale("mcpSettingsMessages");

type Catalog = typeof catalogs;
type CatalogKey = Exclude<keyof Catalog["en"], "dictionary">;

function byLocale<Key extends CatalogKey>(key: Key) {
  return {
    en: catalogs.en[key],
    de: catalogs.de[key],
    it: catalogs.it[key],
  } as const;
}

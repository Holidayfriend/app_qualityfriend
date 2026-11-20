import { supportedLocales, type Locale } from "./dictionaries";

export const localeStorageKey = "qualityfriend-locale";
export const localeCookieName = localeStorageKey;
export const localeCookieMaxAge = 60 * 60 * 24 * 365;
export const localeChangeEvent = "qualityfriend-locale-change";

export type LocaleSource = "cookie" | "account" | "browser" | "default";

export function isLocale(value: string | null | undefined): value is Locale {
  return value != null && supportedLocales.some((locale) => locale === value);
}

export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const code = part.split(";")[0]?.trim().toLowerCase().slice(0, 2) ?? "";
    if (isLocale(code)) return code;
  }
  return null;
}

/** Cookie wins, then the saved account language, then the browser language. */
export function pickLocale(sources: {
  cookie?: string | null;
  account?: string | null;
  acceptLanguage?: string | null;
}): { locale: Locale; source: LocaleSource } {
  const cookie = sources.cookie?.trim().toLowerCase();
  if (isLocale(cookie)) return { locale: cookie, source: "cookie" };
  const account = sources.account?.trim().toLowerCase();
  if (isLocale(account)) return { locale: account, source: "account" };
  const browser = localeFromAcceptLanguage(sources.acceptLanguage);
  if (browser) return { locale: browser, source: "browser" };
  return { locale: "en", source: "default" };
}

export function readLocaleCookie(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${localeCookieName}=([^;]*)`));
  const value = match?.[1] ? decodeURIComponent(match[1]).trim().toLowerCase() : null;
  return isLocale(value) ? value : null;
}

export function writeLocaleCookie(locale: Locale) {
  const secure = location.protocol === "https:" ? ";Secure" : "";
  document.cookie = `${localeCookieName}=${locale};path=/;max-age=${localeCookieMaxAge};SameSite=Lax${secure}`;
}

export function publishLocale(locale: Locale) {
  try { localStorage.setItem(localeStorageKey, locale); } catch { /* Private mode can block storage. */ }
  writeLocaleCookie(locale);
  document.documentElement.lang = locale;
  window.dispatchEvent(new Event(localeChangeEvent));
}

/**
 * Runs before hydration. The server locale stays in place for signed-in accounts.
 * A device locale saved only in localStorage reloads logged-out pages once, so the
 * server can render that language instead of flashing English first.
 */
export function localeBootScript() {
  const key = JSON.stringify(localeCookieName);
  return `(function(){
function write(name,maxAge,value){var secure=location.protocol==="https:"?";Secure":"";document.cookie=name+"="+value+";path=/;max-age="+maxAge+";SameSite=Lax"+secure}
try{
var key=${key};
var maxAge=${localeCookieMaxAge};
var allowed={en:1,de:1,it:1};
var root=document.documentElement;
var server=allowed[root.lang]?root.lang:"en";
var source=root.getAttribute("data-locale-source")||"";
var match=document.cookie.match(new RegExp("(?:^|; )"+key+"=([^;]*)"));
var cookie=match?decodeURIComponent(match[1]).trim().toLowerCase():"";
if(!allowed[cookie])cookie="";
var stored="";
try{stored=localStorage.getItem(key)||""}catch(e){}
stored=String(stored).trim().toLowerCase();
if(!allowed[stored])stored="";
var chosen=cookie||server;
if(!cookie&&stored&&stored!==server&&source!=="account"&&source!=="cookie"){
write(key,maxAge,stored);
var guard="qf-locale-reload";
if(sessionStorage.getItem(guard)!==stored){
sessionStorage.setItem(guard,stored);
root.style.visibility="hidden";
if(window.stop)window.stop();
location.replace(location.href);
}
return;
}
try{sessionStorage.removeItem("qf-locale-reload")}catch(e){}
if(cookie!==chosen)write(key,maxAge,chosen);
try{if(stored!==chosen)localStorage.setItem(key,chosen)}catch(e){}
}catch(e){}
})();`;
}

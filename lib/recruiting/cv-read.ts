const PAGE_MARKER = /--\s*\d+\s+of\s+\d+\s*--/g;

export const NOT_ASSESSABLE = "notAssessable";

export type CvReadState = "ready" | "missing" | "unreadable";

/** Drop extractor page markers so a blank PDF is not treated as CV text. */
export function readableDocumentText(value: string) {
  const cleaned = value
    .replace(/\u0000/g, "")
    .replace(PAGE_MARKER, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!/[\p{L}\p{N}]/u.test(cleaned)) return "";
  return cleaned;
}

export function cvReadState(hasFile: boolean, text: string): CvReadState {
  if (!hasFile) return "missing";
  if (!readableDocumentText(text)) return "unreadable";
  return "ready";
}

export function notAssessableSummaries(state: Exclude<CvReadState, "ready">, fileName: string) {
  const name = fileName.trim() || "CV";
  if (state === "missing") {
    return {
      en: "Not assessable. No CV was uploaded, so this application was not given a fit score.",
      de: "Nicht bewertbar. Es wurde kein Lebenslauf hochgeladen, daher gibt es keine Passungsbewertung.",
      it: "Non valutabile. Non è stato caricato alcun CV, quindi non è stata assegnata una valutazione di idoneità.",
    };
  }
  return {
    en: `Not assessable. ${name} is attached, but its text could not be read, so this application was not given a fit score.`,
    de: `Nicht bewertbar. ${name} ist angehängt, aber der Text konnte nicht gelesen werden. Es gibt daher keine Passungsbewertung.`,
    it: `Non valutabile. ${name} è allegato, ma il testo non è leggibile, quindi non è stata assegnata una valutazione di idoneità.`,
  };
}

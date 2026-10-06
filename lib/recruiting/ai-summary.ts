const headings = { en: "Why this score?", de: "Warum dieser Score?", it: "Perché questo punteggio?" };

export function buildApplicantAiSummary(summary: unknown, reason: unknown, locale: keyof typeof headings) {
  if (typeof summary !== "string" || !summary.trim() || typeof reason !== "string" || !reason.trim()) {
    throw new Error("Invalid model summary or score explanation.");
  }
  return `${summary.trim().slice(0, 1600)}\n\n${headings[locale]}\n${reason.trim().slice(0, 800)}`;
}

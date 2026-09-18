export function pickRecommendationBody(row: { bodyEn: string; bodyDe: string; bodyIt: string }, locale?: string) {
  if (locale === "de" && row.bodyDe.trim()) return row.bodyDe;
  if (locale === "it" && row.bodyIt.trim()) return row.bodyIt;
  return row.bodyEn.trim() || row.bodyDe.trim() || row.bodyIt.trim();
}

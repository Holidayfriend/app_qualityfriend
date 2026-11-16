export function uniqueRecipientIds(groups: string[][], excludeId: string) {
  return [...new Set(groups.flat().filter((id) => id && id !== excludeId))];
}

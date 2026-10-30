export function noServiceAfterSave(input: {
  status: string | null;
  checkbox: boolean;
  previousPreference: string | null | undefined;
  nextPreference: string | null | undefined;
}) {
  const next = input.nextPreference || input.previousPreference || "DAILY";
  if (next === "NONE" || input.status === "noCleaningDesired") return true;
  return input.checkbox;
}

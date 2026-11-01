export type ClassicJobRequiredField = "title" | "dept" | "start" | "description" | "location" | "image" | "logo";

const alwaysOptionalFields = new Set<ClassicJobRequiredField>(["image", "logo"]);
const draftOptionalFields = new Set<ClassicJobRequiredField>(["description", "location"]);

export function classicJobFieldRequired(field: ClassicJobRequiredField, status: string) {
  if (alwaysOptionalFields.has(field)) return false;
  return status !== "draft" || !draftOptionalFields.has(field);
}

export function hasMissingClassicJobFields(missing: Record<ClassicJobRequiredField, boolean>, status: string) {
  return (Object.keys(missing) as ClassicJobRequiredField[])
    .some((field) => missing[field] && classicJobFieldRequired(field, status));
}

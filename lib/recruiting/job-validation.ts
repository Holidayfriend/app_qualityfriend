export type ClassicJobRequiredField = "title" | "dept" | "start" | "description" | "location" | "image" | "logo";

const draftOptionalFields = new Set<ClassicJobRequiredField>(["description", "location", "image", "logo"]);

export function classicJobFieldRequired(field: ClassicJobRequiredField, status: string) {
  return status !== "draft" || !draftOptionalFields.has(field);
}

export function hasMissingClassicJobFields(missing: Record<ClassicJobRequiredField, boolean>, status: string) {
  return (Object.keys(missing) as ClassicJobRequiredField[])
    .some((field) => missing[field] && classicJobFieldRequired(field, status));
}

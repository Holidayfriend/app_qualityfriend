export const checklistItemStates = ["open", "done", "exception"] as const;

export type ChecklistItemState = (typeof checklistItemStates)[number];

export type ChecklistItemCompletionInput = {
  state: ChecklistItemState;
  comment: string;
};

export function isChecklistItemState(value: unknown): value is ChecklistItemState {
  return typeof value === "string" && checklistItemStates.includes(value as ChecklistItemState);
}

export function checklistItemError(item: ChecklistItemCompletionInput) {
  if (item.state === "exception" && !item.comment.trim()) return "EXCEPTION_COMMENT_REQUIRED" as const;
  return null;
}

export function checklistCompletionError(items: ChecklistItemCompletionInput[]) {
  if (items.some((item) => item.state === "open")) return "OPEN_ITEMS" as const;
  if (items.some((item) => checklistItemError(item))) return "EXCEPTION_COMMENT_REQUIRED" as const;
  return null;
}

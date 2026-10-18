type JsonObject = Record<string, unknown>;

export type PortalPrompt = {
  id: string;
  title: string;
  body: string;
  version: string;
  tags: string[];
  categoryId: string;
  categoryName: string;
  departmentId: string;
  departmentName: string;
  authorEmail: string;
  assignedUserIds: string[];
  assignedUsers: Array<{ id: string; email: string }>;
  createdAt: string;
};

export type PortalConversation = {
  id: string;
  title: string;
  createdAt: string;
};

export type PortalPromptFeedback = {
  feedbackScore: number;
  reaction: "like" | "dislike" | null;
};

export function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

export function rows(value: unknown, keys: string[] = ["data"]) {
  if (Array.isArray(value)) return value;
  const root = object(value);
  for (const key of keys) if (Array.isArray(root[key])) return root[key] as unknown[];
  return [];
}

function string(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item)) : [];
}

export function normalizePrompt(value: unknown): PortalPrompt | null {
  const prompt = object(value);
  const id = string(prompt.id);
  const title = string(prompt.title);
  if (!id || !title) return null;
  const category = object(prompt.category);
  const department = object(prompt.department);
  const author = object(prompt.author);
  const assignedUsers = rows(prompt.assignedUsers).flatMap((entry) => {
    const user = object(entry);
    const userId = string(user.id) || string(user.userId);
    if (!userId) return [];
    return [{ id: userId, email: string(user.email) }];
  });
  const assignedUserIds = [...new Set([
    ...stringArray(prompt.assignedUserId),
    ...stringArray(prompt.assignedUserIds),
    ...assignedUsers.map((user) => user.id),
  ])];
  return {
    id,
    title,
    body: string(prompt.body),
    version: string(prompt.version) || "1.0",
    tags: stringArray(prompt.tags),
    categoryId: string(prompt.categoryId) || string(category.id),
    categoryName: string(category.name),
    departmentId: string(prompt.departmentId) || string(department.id),
    departmentName: string(department.name),
    authorEmail: string(author.email) || string(prompt.authorEmail) || string(prompt.authorId),
    assignedUserIds,
    assignedUsers,
    createdAt: string(prompt.createdAt),
  };
}

export function normalizePrompts(payload: unknown) {
  return rows(payload, ["prompts", "data"]).flatMap((entry) => {
    const prompt = normalizePrompt(entry);
    return prompt ? [prompt] : [];
  });
}

export function normalizeConversations(payload: unknown) {
  return rows(payload, ["conversations", "data"]).flatMap((entry) => {
    const conversation = object(entry);
    const id = string(conversation.id);
    if (!id) return [];
    return [{ id, title: string(conversation.title), createdAt: string(conversation.createdAt) }];
  });
}

export function normalizePromptFeedback(payload: unknown): PortalPromptFeedback | null {
  const feedback = object(payload);
  const nested = object(feedback.feedback);
  const value = Object.keys(nested).length ? nested : feedback;
  const score = typeof value.feedbackScore === "number" ? value.feedbackScore : Number(value.feedbackScore);
  const reaction = value.reaction === "like" || value.reaction === "dislike" ? value.reaction : null;
  if (!Number.isFinite(score) && !reaction) return null;
  return { feedbackScore: Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0, reaction };
}

export function normalizeCategories(payload: unknown) {
  return rows(payload, ["categories", "data"]).flatMap((entry) => {
    const row = object(entry);
    const id = string(row.id), name = string(row.name).trim();
    return id && name ? [{ id, name }] : [];
  });
}

export function normalizeDepartments(payload: unknown) {
  return rows(payload, ["departments", "data"]).flatMap((entry) => {
    const row = object(entry);
    const id = string(row.id), name = string(row.name).trim();
    if (!id || !name || row.isActive === false) return [];
    return [{ id, name }];
  });
}

export function normalizeUsers(payload: unknown) {
  return rows(payload, ["users", "data"]).flatMap((entry) => {
    const row = object(entry);
    const id = string(row.id), email = string(row.email).trim();
    if (!id || !email || row.isActive === false || email.toLowerCase().startsWith("default")) return [];
    return [{ id, email }];
  });
}

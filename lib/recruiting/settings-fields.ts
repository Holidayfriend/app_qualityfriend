export type RecruitingEmailSettings = {
  subdomain: string;
  replyEmail: string;
  emailLogo: string;
};

const subdomainPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const logoPattern = /^\/uploads\/recruiting-jobs\/[a-z0-9.-]+$/i;

export function emptyRecruitingSettings(): RecruitingEmailSettings {
  return { subdomain: "", replyEmail: "", emailLogo: "" };
}

export function toPublicSettings(row: { subdomain: string | null; replyEmail: string; emailLogo: string }): RecruitingEmailSettings {
  return { subdomain: row.subdomain ?? "", replyEmail: row.replyEmail, emailLogo: row.emailLogo };
}

export function parseSettingsInput(body: unknown): RecruitingEmailSettings | "INVALID_SUBDOMAIN" | "INVALID_EMAIL" | "INVALID_LOGO" | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  const subdomain = typeof data.subdomain === "string" ? data.subdomain.trim().toLowerCase() : "";
  const replyEmail = typeof data.replyEmail === "string" ? data.replyEmail.trim() : "";
  const emailLogo = typeof data.emailLogo === "string" ? data.emailLogo.trim() : "";
  if (subdomain && !subdomainPattern.test(subdomain)) return "INVALID_SUBDOMAIN";
  if (replyEmail && (replyEmail.length > 320 || !emailPattern.test(replyEmail))) return "INVALID_EMAIL";
  if (emailLogo && !logoPattern.test(emailLogo)) return "INVALID_LOGO";
  return { subdomain, replyEmail, emailLogo };
}

export function settingsAuditSnapshot(settings: RecruitingEmailSettings) {
  return { email: settings.replyEmail || settings.subdomain || "settings", subdomain: settings.subdomain, replyEmail: settings.replyEmail, emailLogo: settings.emailLogo };
}

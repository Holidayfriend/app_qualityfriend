import nodemailer from "nodemailer";
import type { UserWelcomeJob } from "../jobs/queue";

const roles = {
  en: { EMPLOYEE: "Employee", TEAM_LEAD: "Team/Department Lead", MANAGEMENT: "Management", ADMIN: "Administrator" },
  de: { EMPLOYEE: "Mitarbeiter", TEAM_LEAD: "Team-/Abteilungsleitung", MANAGEMENT: "Management", ADMIN: "Administrator" },
  it: { EMPLOYEE: "Dipendente", TEAM_LEAD: "Responsabile team/reparto", MANAGEMENT: "Direzione", ADMIN: "Amministratore" },
} as const;

const copy = {
  en: { subject: "Your QualityFriend account", hello: "Hello", intro: "An account has been created for you.", hotel: "Hotel", email: "Email", password: "Password", department: "Department", role: "Role", signIn: "Sign in", none: "Not assigned", footer: "Powered by QualityFriend" },
  de: { subject: "Ihr QualityFriend-Konto", hello: "Hallo", intro: "Für Sie wurde ein Konto erstellt.", hotel: "Hotel", email: "E-Mail", password: "Passwort", department: "Abteilung", role: "Rolle", signIn: "Anmelden", none: "Nicht zugewiesen", footer: "Powered by QualityFriend" },
  it: { subject: "Il tuo account QualityFriend", hello: "Ciao", intro: "È stato creato un account per te.", hotel: "Hotel", email: "Email", password: "Password", department: "Reparto", role: "Ruolo", signIn: "Accedi", none: "Non assegnato", footer: "Powered by QualityFriend" },
} as const;

export function roleLabel(role: string, locale: UserWelcomeJob["locale"]) {
  return roles[locale][role as keyof typeof roles.en] || role;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function row(label: string, value: string) {
  return `<tr><td style="padding:10px 0;border-bottom:1px solid #eee6d6;color:#8a7352;font-size:12px;letter-spacing:.04em;text-transform:uppercase">${escapeHtml(label)}</td><td style="padding:10px 0 10px 16px;border-bottom:1px solid #eee6d6;color:#1c1915;font-size:15px;font-weight:600">${escapeHtml(value)}</td></tr>`;
}

function welcomeHtml(job: UserWelcomeJob, logoUrl: string) {
  const t = copy[job.locale];
  const logo = logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="QualityFriend" width="36" height="36" style="display:block;border:0;border-radius:8px;background:#fff" />` : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f1e8;font-family:Georgia,serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1e8;padding:32px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
      <tr><td style="background:#1c1915;padding:22px 28px"><table role="presentation"><tr><td style="background:#fff;border-radius:8px;padding:2px">${logo}</td><td style="padding-left:12px;color:#fff;font-family:Arial,sans-serif;font-size:16px;font-weight:700">QualityFriend</td></tr></table></td></tr>
      <tr><td style="padding:28px">
        <p style="margin:0 0 8px;font-size:22px;color:#1c1915">${escapeHtml(t.hello)} ${escapeHtml(job.firstName)},</p>
        <p style="margin:0 0 22px;color:#5c5144;font-size:15px;line-height:1.5">${escapeHtml(t.intro)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${row(t.hotel, job.hotelName)}${row(t.email, job.to)}${row(t.password, job.password)}${row(t.department, job.departmentName || t.none)}${row(t.role, job.roleLabel)}</table>
        <p style="margin:24px 0 0"><a href="${escapeHtml(job.loginUrl)}" style="display:inline-block;background:#c4933a;color:#fff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:12px 18px;border-radius:8px">${escapeHtml(t.signIn)}</a></p>
      </td></tr>
      <tr><td style="padding:18px 28px;background:#fbf7f1;text-align:center;font-family:Arial,sans-serif">
        <p style="margin:0 0 8px;color:#8a7352;font-size:12px">${escapeHtml(t.footer)}</p>${logo}
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

function welcomeText(job: UserWelcomeJob) {
  const t = copy[job.locale];
  return `${t.hello} ${job.firstName},\n\n${t.intro}\n\n${t.hotel}: ${job.hotelName}\n${t.email}: ${job.to}\n${t.password}: ${job.password}\n${t.department}: ${job.departmentName || t.none}\n${t.role}: ${job.roleLabel}\n\n${job.loginUrl}\n\n${t.footer}`;
}

export async function sendUserWelcomeEmail(job: UserWelcomeJob) {
  const host = process.env.MAIL_HOST?.trim();
  const user = process.env.MAIL_USERNAME?.trim();
  const pass = process.env.MAIL_PASSWORD?.trim();
  if (!host || !user || !pass) throw new Error("MAIL_NOT_CONFIGURED");
  const port = Number(process.env.MAIL_PORT || "587");
  const encryption = (process.env.MAIL_ENCRYPTION || "").toLowerCase();
  const fromAddress = process.env.MAIL_FROM_ADDRESS?.trim() || user;
  const fromName = process.env.MAIL_FROM_NAME?.trim() || "QualityFriend";
  const base = (process.env.APP_URL || "https://app.qualityfriend.solutions").replace(/\/$/, "");
  const logoUrl = `${base}/recruiting/logo-icon.png`;
  const transport = nodemailer.createTransport({ host, port, secure: encryption === "ssl" || port === 465, auth: { user, pass } });
  await transport.sendMail({
    from: `"${fromName.replace(/"/g, "")}" <${fromAddress}>`,
    to: job.to,
    subject: copy[job.locale].subject,
    text: welcomeText(job),
    html: welcomeHtml(job, logoUrl),
  });
  return { sent: true };
}

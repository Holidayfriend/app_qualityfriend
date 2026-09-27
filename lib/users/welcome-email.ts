import nodemailer from "nodemailer";
import type { UserWelcomeJob } from "../jobs/queue";

const roles = {
  en: { EMPLOYEE: "Employee", TEAM_LEAD: "Team/Department Lead", MANAGEMENT: "Management", ADMIN: "Administrator" },
  de: { EMPLOYEE: "Mitarbeiter", TEAM_LEAD: "Team-/Abteilungsleitung", MANAGEMENT: "Management", ADMIN: "Administrator" },
  it: { EMPLOYEE: "Dipendente", TEAM_LEAD: "Responsabile team/reparto", MANAGEMENT: "Direzione", ADMIN: "Amministratore" },
} as const;

const copy = {
  en: { subject: "Your QualityFriend account", ready: "Your account is ready", hello: "Hello", introBefore: "An account has been created for you at ", introAfter: ". Sign in with the details below.", hotel: "Hotel", email: "Email", password: "Password", department: "Department", role: "Role", signIn: "Sign in", none: "Not assigned", privacy: "Keep this password private. You can change it after you sign in.", footer: "Powered by QualityFriend" },
  de: { subject: "Ihr QualityFriend-Konto", ready: "Ihr Konto ist bereit", hello: "Hallo", introBefore: "Für Sie wurde ein Konto bei ", introAfter: " erstellt. Melden Sie sich mit den folgenden Angaben an.", hotel: "Hotel", email: "E-Mail", password: "Passwort", department: "Abteilung", role: "Rolle", signIn: "Anmelden", none: "Nicht zugewiesen", privacy: "Bewahren Sie dieses Passwort vertraulich auf. Sie können es nach der Anmeldung ändern.", footer: "Powered by QualityFriend" },
  it: { subject: "Il tuo account QualityFriend", ready: "Il tuo account è pronto", hello: "Ciao", introBefore: "È stato creato un account per te presso ", introAfter: ". Accedi con i dati qui sotto.", hotel: "Hotel", email: "Email", password: "Password", department: "Reparto", role: "Ruolo", signIn: "Accedi", none: "Non assegnato", privacy: "Tieni privata questa password. Puoi cambiarla dopo l'accesso.", footer: "Powered by QualityFriend" },
} as const;

export function roleLabel(role: string, locale: UserWelcomeJob["locale"]) {
  return roles[locale][role as keyof typeof roles.en] || role;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const font = "Segoe UI,Arial,sans-serif";

function field(label: string, value: string, last = false) {
  return `<p style="margin:${last ? "0" : "14px 0 0"};font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#9ca3af">${escapeHtml(label)}</p><p style="margin:2px 0 ${last ? "14px" : "0"};font-size:15px;font-weight:600;color:#1c2233">${escapeHtml(value)}</p>`;
}

function welcomeHtml(job: UserWelcomeJob, logoUrl: string) {
  const t = copy[job.locale];
  const logo = logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="QualityFriend" width="44" height="44" style="display:block;border:0;border-radius:8px" />` : "";
  const footerLogo = logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="" width="36" height="36" style="display:inline-block;border:0;border-radius:8px" />` : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f2ee">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee"><tr><td align="center" style="padding:40px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e8e6e1;border-radius:16px;overflow:hidden">
      <tr><td style="background:#1c2233;padding:22px 28px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="background:#ffffff;border-radius:12px;padding:4px">${logo}</td>
        <td style="padding-left:14px;font-family:${font};font-size:18px;font-weight:700;color:#ffffff">QualityFriend</td>
      </tr></table></td></tr>
      <tr><td style="height:3px;background:#c4933a;font-size:0;line-height:0">&nbsp;</td></tr>
      <tr><td style="padding:32px 32px 8px;font-family:${font}">
        <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#c4933a">${escapeHtml(t.ready)}</p>
        <p style="margin:10px 0 0;font-size:26px;line-height:1.25;font-weight:700;color:#1c2233">${escapeHtml(t.hello)} ${escapeHtml(job.firstName)},</p>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#6b7280">${escapeHtml(t.introBefore)}<strong style="color:#1c2233">${escapeHtml(job.hotelName)}</strong>${escapeHtml(t.introAfter)}</p>
      </td></tr>
      <tr><td style="padding:20px 32px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6f3;border:1px solid #e8e6e1;border-radius:12px"><tr><td style="padding:6px 18px 4px;font-family:${font}">
        ${field(t.hotel, job.hotelName)}${field(t.email, job.to)}${field(t.department, job.departmentName || t.none)}${field(t.role, job.roleLabel, true)}
      </td></tr></table></td></tr>
      <tr><td style="padding:12px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f5e8cc;background:#fffaf2;border-radius:12px"><tr><td style="padding:14px 18px;font-family:${font}">
        <p style="margin:0;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#ad7f2e">${escapeHtml(t.password)}</p>
        <p style="margin:6px 0 0;font-family:Consolas,Courier New,monospace;font-size:18px;font-weight:700;letter-spacing:.04em;color:#1c2233">${escapeHtml(job.password)}</p>
      </td></tr></table></td></tr>
      <tr><td style="padding:24px 32px 8px"><a href="${escapeHtml(job.loginUrl)}" style="display:inline-block;background:#c4933a;color:#ffffff;text-decoration:none;font-family:${font};font-size:14px;font-weight:700;padding:13px 22px;border-radius:10px">${escapeHtml(t.signIn)}</a></td></tr>
      <tr><td style="padding:8px 32px 28px;font-family:${font};font-size:13px;line-height:1.5;color:#9ca3af">${escapeHtml(t.privacy)}</td></tr>
      <tr><td style="padding:18px 32px 22px;border-top:1px solid #e8e6e1;background:#fafaf8;text-align:center;font-family:${font}">
        ${footerLogo}
        <p style="margin:10px 0 0;font-size:12px;color:#6b7280">${escapeHtml(t.footer)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#9ca3af">qualityfriend.solutions</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

function welcomeText(job: UserWelcomeJob) {
  const t = copy[job.locale];
  return `${t.hello} ${job.firstName},\n\n${t.introBefore}${job.hotelName}${t.introAfter}\n\n${t.hotel}: ${job.hotelName}\n${t.email}: ${job.to}\n${t.password}: ${job.password}\n${t.department}: ${job.departmentName || t.none}\n${t.role}: ${job.roleLabel}\n\n${job.loginUrl}\n\n${t.privacy}\n\n${t.footer}`;
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

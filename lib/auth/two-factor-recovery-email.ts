import "server-only";
import { sendMail } from "../mail/smtp";

const copy = {
  en: { subject: "Your QualityFriend verification code", hello: "Hello", body: "Use this one-time code to recover access and set up your authenticator on a new phone.", expires: "This code expires in 5 minutes.", ignore: "If you did not request this code, change your password immediately." },
  de: { subject: "Ihr QualityFriend-Bestätigungscode", hello: "Hallo", body: "Verwenden Sie diesen Einmalcode, um den Zugriff wiederherzustellen und den Authenticator auf einem neuen Telefon einzurichten.", expires: "Dieser Code läuft in 5 Minuten ab.", ignore: "Wenn Sie diesen Code nicht angefordert haben, ändern Sie sofort Ihr Passwort." },
  it: { subject: "Il tuo codice di verifica QualityFriend", hello: "Ciao", body: "Usa questo codice monouso per recuperare l'accesso e configurare l'autenticatore su un nuovo telefono.", expires: "Il codice scade tra 5 minuti.", ignore: "Se non hai richiesto questo codice, cambia subito la password." },
} as const;

function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

export function sendTwoFactorRecoveryEmail(input: { to: string; firstName: string; code: string; locale: keyof typeof copy }) {
  const t = copy[input.locale];
  const text = `${t.hello} ${input.firstName},\n\n${t.body}\n\n${input.code}\n\n${t.expires}\n${t.ignore}\n\nPowered by QualityFriend`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f2ee"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e8e6e1;border-radius:16px;overflow:hidden"><tr><td style="background:#1c2233;padding:22px 28px;font:700 18px Segoe UI,Arial;color:#fff">QualityFriend</td></tr><tr><td style="height:3px;background:#c4933a"></td></tr><tr><td style="padding:32px;font-family:Segoe UI,Arial"><h1 style="margin:0;color:#1c2233;font-size:25px">${escapeHtml(t.hello)} ${escapeHtml(input.firstName)},</h1><p style="color:#6b7280;line-height:1.6">${escapeHtml(t.body)}</p><div style="margin:24px 0;padding:18px;border-radius:10px;background:#f4f2ee;text-align:center;font-size:30px;font-weight:700;letter-spacing:8px;color:#1c2233">${input.code}</div><p style="color:#6b7280">${escapeHtml(t.expires)}</p><p style="color:#9ca3af;font-size:13px">${escapeHtml(t.ignore)}</p></td></tr></table></td></tr></table></body></html>`;
  return sendMail({ to: input.to, subject: t.subject, text, html });
}

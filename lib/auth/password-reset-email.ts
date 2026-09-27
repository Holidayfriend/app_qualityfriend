import { sendMail } from "../mail/smtp";

type Locale = "en" | "de" | "it";

const copy = {
  en: {
    subject: "Reset your QualityFriend password",
    kicker: "Password reset",
    hello: "Hello",
    body: "We received a request to reset the password for your QualityFriend account. This link is valid for 1 hour.",
    button: "Reset password",
    ignore: "If you did not request this, you can ignore this email. Your password will stay the same.",
    footer: "Powered by QualityFriend",
  },
  de: {
    subject: "Setzen Sie Ihr QualityFriend-Passwort zurück",
    kicker: "Passwort zurücksetzen",
    hello: "Hallo",
    body: "Wir haben eine Anfrage zum Zurücksetzen des Passworts für Ihr QualityFriend-Konto erhalten. Dieser Link ist 1 Stunde gültig.",
    button: "Passwort zurücksetzen",
    ignore: "Wenn Sie dies nicht angefordert haben, können Sie diese E-Mail ignorieren. Ihr Passwort bleibt unverändert.",
    footer: "Powered by QualityFriend",
  },
  it: {
    subject: "Reimposta la password di QualityFriend",
    kicker: "Reimpostazione password",
    hello: "Ciao",
    body: "Abbiamo ricevuto una richiesta di reimpostazione della password del tuo account QualityFriend. Questo link è valido per 1 ora.",
    button: "Reimposta password",
    ignore: "Se non hai richiesto questa operazione, puoi ignorare questa e-mail. La password resterà invariata.",
    footer: "Powered by QualityFriend",
  },
} as const;

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sendPasswordResetEmail(input: { to: string; firstName: string; resetUrl: string; locale: Locale }) {
  const t = copy[input.locale];
  const font = "Segoe UI,Arial,sans-serif";
  const text = `${t.hello} ${input.firstName},\n\n${t.body}\n\n${input.resetUrl}\n\n${t.ignore}\n\n${t.footer}`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f2ee">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee"><tr><td align="center" style="padding:40px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e8e6e1;border-radius:16px;overflow:hidden">
      <tr><td style="background:#1c2233;padding:22px 28px;font-family:${font};font-size:18px;font-weight:700;color:#ffffff">QualityFriend</td></tr>
      <tr><td style="height:3px;background:#c4933a;font-size:0;line-height:0">&nbsp;</td></tr>
      <tr><td style="padding:32px 32px 8px;font-family:${font}">
        <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#c4933a">${escapeHtml(t.kicker)}</p>
        <p style="margin:10px 0 0;font-size:26px;line-height:1.25;font-weight:700;color:#1c2233">${escapeHtml(t.hello)} ${escapeHtml(input.firstName)},</p>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#6b7280">${escapeHtml(t.body)}</p>
      </td></tr>
      <tr><td style="padding:24px 32px 8px"><a href="${escapeHtml(input.resetUrl)}" style="display:inline-block;background:#c4933a;color:#ffffff;text-decoration:none;font-family:${font};font-size:14px;font-weight:700;padding:13px 22px;border-radius:10px">${escapeHtml(t.button)}</a></td></tr>
      <tr><td style="padding:8px 32px 28px;font-family:${font};font-size:13px;line-height:1.5;color:#9ca3af">${escapeHtml(t.ignore)}</td></tr>
      <tr><td style="padding:18px 32px 22px;border-top:1px solid #e8e6e1;background:#fafaf8;text-align:center;font-family:${font}">
        <p style="margin:0;font-size:12px;color:#6b7280">${escapeHtml(t.footer)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#9ca3af">qualityfriend.solutions</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  return sendMail({ to: input.to, subject: t.subject, text, html });
}

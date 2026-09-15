import "server-only";

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

let transporter: Transporter | null | undefined;

function mailEnabled() {
  return Boolean(process.env.MAIL_HOST?.trim() && process.env.MAIL_USERNAME?.trim() && process.env.MAIL_PASSWORD?.trim());
}

function getTransporter() {
  if (transporter !== undefined) return transporter;
  if (!mailEnabled()) {
    transporter = null;
    return transporter;
  }
  const port = Number(process.env.MAIL_PORT || "2525");
  const encryption = (process.env.MAIL_ENCRYPTION || "").toLowerCase();
  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST!.trim(),
    port,
    secure: encryption === "ssl" || port === 465,
    auth: {
      user: process.env.MAIL_USERNAME!.trim(),
      pass: process.env.MAIL_PASSWORD!.trim(),
    },
  });
  return transporter;
}

export function isMailConfigured() {
  return mailEnabled();
}

export async function sendMail(payload: MailPayload) {
  const client = getTransporter();
  if (!client) return { sent: false as const, reason: "MAIL_NOT_CONFIGURED" as const };
  const fromAddress = process.env.MAIL_FROM_ADDRESS?.trim() || process.env.MAIL_USERNAME!.trim();
  const fromName = process.env.MAIL_FROM_NAME?.trim() || "QualityFriend";
  await client.sendMail({
    from: `"${fromName.replace(/"/g, "")}" <${fromAddress}>`,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    replyTo: payload.replyTo || undefined,
  });
  return { sent: true as const };
}

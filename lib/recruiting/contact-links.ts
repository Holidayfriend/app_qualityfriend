type RecruitingContactMessage = {
  to: string;
  phone: string;
  subject: string;
  text: string;
};

export function recruitingMailUrl(message: RecruitingContactMessage) {
  const query = new URLSearchParams({ subject: message.subject, body: message.text });
  return `mailto:${message.to.trim()}?${query.toString()}`;
}

export function recruitingWhatsAppUrl(message: RecruitingContactMessage) {
  const rawDigits = message.phone.replace(/\D/g, "");
  const digits = rawDigits.startsWith("00") ? rawDigits.slice(2) : rawDigits;
  if (!digits) return "";
  const text = [message.subject.trim(), message.text.trim()].filter(Boolean).join("\n\n");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

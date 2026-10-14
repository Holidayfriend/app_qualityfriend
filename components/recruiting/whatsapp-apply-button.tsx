export function WhatsAppApplyButton({ enabled, number, label }: { enabled: boolean; number: string; label: string }) {
  const digits = number.replace(/\D/g, "");
  if (!enabled || !digits) return null;
  return <a className="job-apply-whatsapp" href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" aria-label={label} title={label}>
    <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3Zm0 2.3a10.7 10.7 0 1 1-5.5 19.9l-.8-.5-3.5.9.9-3.4-.5-.8A10.7 10.7 0 0 1 16 5.3Zm-5.2 5.1c-.3 0-.7.1-1 .5-.4.4-1.4 1.4-1.4 3.4s1.4 3.9 1.6 4.2c.2.3 2.8 4.3 6.8 6 .9.4 1.7.6 2.2.7.9.3 1.8.2 2.5.1.8-.1 2.4-1 2.7-1.9.3-.9.3-1.7.2-1.9-.1-.2-.4-.3-.8-.5l-2.7-1.3c-.4-.2-.7-.3-1 .3l-1.2 1.5c-.2.3-.5.3-.9.1-1.2-.6-2.2-1.3-3-2.1a11 11 0 0 1-2-2.5c-.2-.4 0-.6.2-.8l.6-.7.4-.7c.1-.3.1-.5 0-.7l-1.2-2.9c-.3-.8-.7-.8-1-.8h-.8Z" /></svg>
  </a>;
}

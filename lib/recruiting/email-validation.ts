/** Practical email format validation; does not verify mailbox ownership. */
export function isValidApplicationEmail(value: string) {
  const email = value.trim();
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return false;
  const [local, domain] = email.split("@");
  return local.length <= 64 && !local.startsWith(".") && !local.endsWith(".") && !local.includes("..")
    && domain.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

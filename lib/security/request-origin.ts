// Compare against the public Host header as well as Next's internal request URL.
// Reverse proxies can forward a public origin to an internal localhost URL.
export function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const hosts = [new URL(request.url).host, request.headers.get("host"), request.headers.get("x-forwarded-host")?.split(",")[0].trim()];
    return hosts.some(host => host?.toLowerCase() === parsed.host.toLowerCase());
  } catch { return false; }
}

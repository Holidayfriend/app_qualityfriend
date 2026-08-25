import "server-only";

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "../prisma";

const windowMilliseconds = 15 * 60 * 1000;
const maximumRequests = 5;

function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function registrationRateLimit(request: Request) {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMilliseconds) * windowMilliseconds);
  const expiresAt = new Date(windowStart.getTime() + windowMilliseconds);
  const keyHash = createHash("sha256").update(clientAddress(request)).digest("hex");

  const entry = await prisma.registrationRateLimit.upsert({
    where: { keyHash_windowStart: { keyHash, windowStart } },
    create: { keyHash, windowStart, expiresAt },
    update: { requestCount: { increment: 1 } },
    select: { requestCount: true },
  });

  if (entry.requestCount <= maximumRequests) return null;

  const retryAfter = Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000));
  return NextResponse.json(
    { error: "RATE_LIMITED", retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } },
  );
}

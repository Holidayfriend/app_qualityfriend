import "server-only";

import { cookies, headers } from "next/headers";
import { getRawSessionUserId } from "../auth/session";
import { prisma } from "../prisma";
import { isLocale, localeCookieName, pickLocale, type LocaleSource } from "./locale";
import type { Locale } from "./dictionaries";

export async function resolveRequestLocale(): Promise<{ locale: Locale; source: LocaleSource }> {
  const cookie = (await cookies()).get(localeCookieName)?.value ?? null;
  if (isLocale(cookie?.trim().toLowerCase())) return pickLocale({ cookie });

  let account: string | null = null;
  try {
    const userId = await getRawSessionUserId();
    if (userId) {
      const user = await prisma.user.findFirst({
        where: { id: userId, isActive: true, isDeleted: false },
        select: { language: true },
      });
      account = user?.language ?? null;
    }
  } catch (error) {
    console.error("locale lookup failed", error);
  }

  const acceptLanguage = (await headers()).get("accept-language");
  return pickLocale({ account, acceptLanguage });
}

import { randomUUID } from "node:crypto";
import type { AiRecommendationPlace, PrismaClient } from "../../app/generated/prisma/client";

export async function saveHotelAiRecommendation(
  prisma: PrismaClient,
  hotelTenantId: string,
  place: AiRecommendationPlace,
  bodies: { bodyEn: string; bodyDe: string; bodyIt: string },
) {
  const generatedAt = new Date();
  const existing = await prisma.hotelAiRecommendation.findUnique({
    where: { hotelTenantId_place: { hotelTenantId, place } },
  });
  if (existing) {
    await prisma.hotelAiRecommendation.update({
      where: { hotelTenantId_place: { hotelTenantId, place } },
      data: { ...bodies, generatedAt },
    });
    return;
  }
  await prisma.hotelAiRecommendation.create({
    data: { id: randomUUID(), hotelTenantId, place, ...bodies, generatedAt },
  });
}

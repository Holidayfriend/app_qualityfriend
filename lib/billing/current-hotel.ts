import "server-only";
import { prisma } from "../prisma";
import { getRawSessionUserId } from "../auth/session";

export async function currentBillingHotel(requireAdmin = false) {
  const userId = await getRawSessionUserId();
  if (!userId) return null;
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, isDeleted: false },
    select: {
      id: true,
      role: true,
      hotelTenantId: true,
      language: true,
      hotelTenant: {
        select: {
          companyName: true,
          subscriptionStatus: true,
          paypalSubscriptionId: true,
          paypalPlanId: true,
          subscriptionStartedAt: true,
          subscriptionCurrentPeriodEnd: true,
          subscriptionCancelledAt: true,
        },
      },
    },
  });
  if (!user || (requireAdmin && user.role !== "ADMIN")) return null;
  return user;
}

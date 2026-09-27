import { getJobQueue, queues, type HotelWelcomeJob } from "../jobs/queue";
import { prisma } from "../prisma";

export async function dispatchHotelWelcomeEmail(data: HotelWelcomeJob) {
  const boss = await getJobQueue();
  return boss.send(queues.hotelWelcome, data, { singletonKey: data.to });
}

export async function queueHotelWelcomeEmail(hotelTenantId: string) {
  const claimed = await prisma.hotelTenant.updateMany({
    where: { id: hotelTenantId, welcomeEmailSentAt: null, subscriptionStatus: "ACTIVE" },
    data: { welcomeEmailSentAt: new Date() },
  });
  if (!claimed.count) return null;
  try {
    const hotel = await prisma.hotelTenant.findUnique({
      where: { id: hotelTenantId },
      select: { hotelNameEn: true, hotelNameDe: true, hotelNameIt: true, hotelLanguage: true },
    });
    const admin = await prisma.user.findFirst({
      where: { hotelTenantId, role: "ADMIN", isDeleted: false, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { firstName: true, email: true, language: true },
    });
    if (!hotel || !admin) {
      await prisma.hotelTenant.update({ where: { id: hotelTenantId }, data: { welcomeEmailSentAt: null } });
      return null;
    }
    const language = admin.language || hotel.hotelLanguage;
    const locale = language === "DE" ? "de" : language === "IT" ? "it" : "en";
    const hotelName = locale === "de" ? hotel.hotelNameDe : locale === "it" ? hotel.hotelNameIt : hotel.hotelNameEn;
    return await dispatchHotelWelcomeEmail({
      to: admin.email,
      firstName: admin.firstName,
      email: admin.email,
      hotelName: hotelName || hotel.hotelNameEn,
      loginUrl: `${(process.env.APP_URL || "").replace(/\/$/, "")}/login`,
      locale,
    });
  } catch (error) {
    await prisma.hotelTenant.update({ where: { id: hotelTenantId }, data: { welcomeEmailSentAt: null } }).catch(() => {});
    throw error;
  }
}

import "server-only";

import type { Prisma } from "../../app/generated/prisma/client";

type JobTitles = {
  title: string;
  titleDe: string;
  titleIt: string;
  format: string;
};

type ApplicantName = {
  firstName: string;
  lastName: string;
};

async function recruitingRecipientIds(tx: Prisma.TransactionClient, hotelTenantId: string) {
  const [users, permissions] = await Promise.all([
    tx.user.findMany({
      where: { hotelTenantId, isActive: true, isDeleted: false },
      select: { id: true, role: true },
    }),
    tx.roleModulePermission.findMany({
      where: { hotelTenantId, moduleKey: "recruiting", canView: true },
      select: { role: true },
    }),
  ]);
  const allowedRoles = new Set(permissions.map((item) => item.role));
  return users.filter((user) => user.role === "ADMIN" || allowedRoles.has(user.role)).map((user) => user.id);
}

function applicationText(job: JobTitles, applicant: ApplicantName) {
  const name = `${applicant.firstName} ${applicant.lastName}`.trim();
  const format = String(job.format).toUpperCase() === "QUIZ" ? "Quiz" : "Classic";
  const titleEn = job.title.trim() || job.titleDe.trim() || job.titleIt.trim();
  const titleDe = job.titleDe.trim() || titleEn;
  const titleIt = job.titleIt.trim() || titleEn;
  return {
    titleEn: "New job application",
    titleDe: "Neue Bewerbung",
    titleIt: "Nuova candidatura",
    bodyEn: `${name} applied for “${titleEn}” (${format}).`,
    bodyDe: `${name} hat sich auf „${titleDe}“ beworben (${format}).`,
    bodyIt: `${name} ha inviato una candidatura per “${titleIt}” (${format}).`,
  };
}


export async function notifyNewRecruitingApplication(
  tx: Prisma.TransactionClient,
  data: {
    hotelTenantId: string;
    applicationId: string;
    job: JobTitles;
    applicant: ApplicantName;
    excludeRecipientId?: string;
  },
) {
  const recipients = (await recruitingRecipientIds(tx, data.hotelTenantId)).filter(
    (id) => id !== data.excludeRecipientId,
  );
  if (!recipients.length) return;
  const text = applicationText(data.job, data.applicant);
  await tx.notification.createMany({
    data: recipients.map((recipientId) => ({
      hotelTenantId: data.hotelTenantId,
      recipientId,
      moduleKey: "recruiting",
      eventKey: `recruiting-application:${data.applicationId}`,
      icon: "jobs",
      destination: `/recruiting/applications/${data.applicationId}`,
      ...text,
      requiredScope: "OWN" as const,
    })),
    skipDuplicates: true,
  });
}

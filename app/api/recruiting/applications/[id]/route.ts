import { Prisma } from "../../../../../app/generated/prisma/client";
import { prisma } from "../../../../../lib/prisma";
import { recordAuditLog } from "../../../../../lib/audit/audit-service";
import { recruitingActor } from "../../../../../lib/recruiting/access";
import { isUuid, notesPayload, parseApplicationNotes, toDbStage, toPublicApplicant } from "../../../../../lib/recruiting/application-fields";
import { sendRecruitingTemplateEmail } from "../../../../../lib/recruiting/send-recruiting-email";
import type { Applicant } from "../../../../../lib/recruiting/preview-data";

type Context = { params: Promise<{ id: string }> };

const jobInclude = {
  select: {
    title: true,
    titleDe: true,
    titleIt: true,
    format: true,
    department: { select: { nameEn: true, nameDe: true, nameIt: true } },
  },
} as const;

export async function GET(request: Request, context: Context) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  if (!isUuid(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const row = await prisma.recruitingApplication.findFirst({
    where: { id, hotelTenantId: actor.hotel_tenant_id },
    include: { job: jobInclude },
  });
  if (!row) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ application: toPublicApplicant(row, row.job, locale) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: Context) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const data = body as { stage?: string; locale?: string; tags?: unknown; comments?: unknown };
  const stage = typeof data.stage === "string" ? toDbStage(data.stage) : null;
  const hasNotes = "tags" in data || "comments" in data;
  if (!stage && !hasNotes) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const locale = typeof data.locale === "string" ? data.locale : "";

  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.recruitingApplication.findFirst({ where: { id, hotelTenantId: actor.hotel_tenant_id } });
    if (!before) return null;
    const patch: { stage?: typeof stage; notes?: Prisma.InputJsonValue } = {};
    if (stage) patch.stage = stage;
    if (hasNotes) {
      const current = parseApplicationNotes(before.notes);
      const tags = Array.isArray(data.tags)
        ? data.tags.map((tag) => (typeof tag === "string" ? tag.trim() : "")).filter(Boolean)
        : current.tags;
      const comments = Array.isArray(data.comments)
        ? (data.comments as Applicant["comments"])
        : current.comments;
      patch.notes = notesPayload(tags, comments) as Prisma.InputJsonValue;
    }
    const after = await tx.recruitingApplication.update({
      where: { id },
      data: patch,
      include: { job: jobInclude },
    });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: stage ? "STATUS_CHANGE" : "UPDATE",
      entityType: "RECRUITING_APPLICATION",
      entityId: id,
      changes: {
        before: stage ? { stage: before.stage } : { notes: before.notes },
        after: stage ? { stage: after.stage } : { notes: after.notes },
      },
    });
    return { after, previousStage: before.stage };
  });
  if (!updated) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  let emailSent = false;
  let emailAuto = false;
  if (stage && stage !== updated.previousStage) {
    const category = stage === "OFFER" ? "offer" : stage === "REJECTED" ? "reject" : null;
    if (category) {
      const mail = await sendRecruitingTemplateEmail({
        hotelTenantId: actor.hotel_tenant_id,
        category,
        applicationId: id,
      });
      emailSent = mail.sent;
      emailAuto = mail.auto;
    }
  }

  return Response.json({
    application: toPublicApplicant(updated.after, updated.after.job, locale),
    emailSent,
    emailAuto,
  });
}

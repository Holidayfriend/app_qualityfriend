import { canChangeApplicationStage } from "../../../../../lib/recruiting/application-actions";
import { isValidApplicationEmail } from "../../../../../lib/recruiting/email-validation";
import { Prisma } from "../../../../../app/generated/prisma/client";
import { prisma } from "../../../../../lib/prisma";
import { recordAuditLog } from "../../../../../lib/audit/audit-service";
import { hotelTimeZoneFor } from "../../../../../lib/hotel/context";
import { recruitingActor } from "../../../../../lib/recruiting/access";
import { isUuid, notesPayload, parseApplicationNotes, toDbStage, toPublicApplicant } from "../../../../../lib/recruiting/application-fields";
import { prepareRecruitingTemplateEmail, recruitingConfirmationToken, sendPreparedRecruitingEmail, type RecruitingEmailPreview } from "../../../../../lib/recruiting/send-recruiting-email";
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

function clampScore(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function parseCompetencies(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const social = clampScore(body.social);
  const professional = clampScore(body.professional);
  const methodical = clampScore(body.methodical);
  const personal = clampScore(body.personal);
  if (social == null || professional == null || methodical == null || personal == null) return null;
  return { social, professional, methodical, personal };
}

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
  const previewStage = new URL(request.url).searchParams.get("previewStage");
  if (previewStage) {
    if ((previewStage !== "offer" && previewStage !== "rejected") || !canChangeApplicationStage(row.stage, previewStage)) return Response.json({ error: "INVALID_STAGE" }, { status: 409 });
    try {
      const preview = await prepareRecruitingTemplateEmail({ hotelTenantId: actor.hotel_tenant_id, applicationId: id, category: previewStage === "offer" ? "offer" : "reject" });
      return Response.json({ preview, token: recruitingConfirmationToken(previewStage, row.updatedAt.toISOString(), preview) }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return Response.json({ error: "PREVIEW_FAILED" }, { status: 502 });
    }
  }
  return Response.json({ application: toPublicApplicant(row, row.job, locale, { timeZone: await hotelTimeZoneFor(actor.hotel_tenant_id) }) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: Context) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const data = body as { confirmationToken?: unknown; email?: unknown; stage?: string; locale?: string; tags?: unknown; comments?: unknown; competencies?: unknown };
  const hasEmail = "email" in data;
  const email = typeof data.email === "string" ? data.email.trim() : "";
  if (hasEmail && !isValidApplicationEmail(email)) return Response.json({ error: "INVALID_EMAIL" }, { status: 400 });
  const stage = typeof data.stage === "string" ? toDbStage(data.stage) : null;
  const hasNotes = "tags" in data || "comments" in data;
  const competencies = parseCompetencies(data.competencies);
  if (!stage && !hasNotes && !competencies && !hasEmail) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const locale = typeof data.locale === "string" ? data.locale : "";

  let preparedEmail: RecruitingEmailPreview | null = null;
  let confirmedVersion: string | null = null;
  if (stage === "OFFER" || stage === "REJECTED") {
    if (typeof data.confirmationToken !== "string" || hasEmail || hasNotes || competencies) return Response.json({ error: "CONFIRMATION_REQUIRED" }, { status: 409 });
    const current = await prisma.recruitingApplication.findFirst({ where: { id, hotelTenantId: actor.hotel_tenant_id } });
    if (!current) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    if (!canChangeApplicationStage(current.stage, stage)) return Response.json({ error: "INVALID_STAGE" }, { status: 409 });
    try {
      preparedEmail = await prepareRecruitingTemplateEmail({ hotelTenantId: actor.hotel_tenant_id, applicationId: id, category: stage === "OFFER" ? "offer" : "reject" });
    } catch { return Response.json({ error: "PREVIEW_FAILED" }, { status: 502 }); }
    confirmedVersion = current.updatedAt.toISOString();
    if (data.confirmationToken !== recruitingConfirmationToken(stage.toLowerCase(), confirmedVersion, preparedEmail)) return Response.json({ error: "PREVIEW_CHANGED" }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.recruitingApplication.findFirst({ where: { id, hotelTenantId: actor.hotel_tenant_id } });
    if (!before) return null;
    if (stage && (!canChangeApplicationStage(before.stage, stage) || stage === "HIRED")) return { conflict: true as const };
    if (confirmedVersion && before.updatedAt.toISOString() !== confirmedVersion) return { conflict: true as const };
    const patch: Prisma.RecruitingApplicationUncheckedUpdateInput = {};
    if (stage) patch.stage = stage;
    if (hasEmail) patch.email = email;
    if (competencies) {
      patch.aiSocial = competencies.social;
      patch.aiProfessional = competencies.professional;
      patch.aiMethodical = competencies.methodical;
      patch.aiPersonal = competencies.personal;
    }
    if (hasNotes) {
      const current = parseApplicationNotes(before.notes);
      const tags = Array.isArray(data.tags)
        ? data.tags.map((tag) => (typeof tag === "string" ? tag.trim() : "")).filter(Boolean)
        : current.tags;
      const comments = Array.isArray(data.comments)
        ? (data.comments as Applicant["comments"])
        : current.comments;
      patch.notes = notesPayload(tags, comments, current.files, current.campaign) as Prisma.InputJsonValue;
    }
    const changed = await tx.recruitingApplication.updateMany({
      where: { id, hotelTenantId: actor.hotel_tenant_id, updatedAt: before.updatedAt, stage: before.stage },
      data: patch,
    });
    if (changed.count !== 1) return { conflict: true as const };
    const after = await tx.recruitingApplication.findUniqueOrThrow({ where: { id }, include: { job: jobInclude } });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: stage ? "STATUS_CHANGE" : "UPDATE",
      entityType: "RECRUITING_APPLICATION",
      entityId: id,
      changes: {
        ...(hasEmail ? { email: { before: before.email, after: after.email } } : {}),
        before: stage ? { stage: before.stage } : competencies ? { competencies: { social: before.aiSocial, professional: before.aiProfessional, methodical: before.aiMethodical, personal: before.aiPersonal } } : { notes: before.notes },
        after: stage ? { stage: after.stage } : competencies ? { competencies } : { notes: after.notes },
      },
    });
    return { after, previousStage: before.stage };
  });
  if (!updated) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  if ("conflict" in updated) return Response.json({ error: "INVALID_STAGE" }, { status: 409 });

  let emailSent = false;
  let emailAuto = false;
  if (preparedEmail) {
    const mail = await sendPreparedRecruitingEmail(preparedEmail);
    emailSent = mail.sent;
    emailAuto = mail.auto;
  }

  return Response.json({
    application: toPublicApplicant(updated.after, updated.after.job, locale, { timeZone: await hotelTimeZoneFor(actor.hotel_tenant_id) }),
    emailSent,
    emailAuto,
  });
}

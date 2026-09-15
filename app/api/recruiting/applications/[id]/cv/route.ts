import { NextResponse } from "next/server";
import { recordAuditLog } from "../../../../../../lib/audit/audit-service";
import { recruitingActor } from "../../../../../../lib/recruiting/access";
import { isUuid, toPublicApplicant } from "../../../../../../lib/recruiting/application-fields";
import {
  cvMime,
  deleteRecruitingCv,
  packCvRef,
  readRecruitingCv,
  saveRecruitingCv,
  unpackCvRef,
} from "../../../../../../lib/recruiting/cv-storage";
import { prisma } from "../../../../../../lib/prisma";

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

export async function GET(_request: Request, context: Context) {
  const actor = await recruitingActor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const row = await prisma.recruitingApplication.findFirst({
    where: { id, hotelTenantId: actor.hotel_tenant_id },
    select: { cvFileName: true },
  });
  if (!row?.cvFileName) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const { storageKey, displayName } = unpackCvRef(row.cvFileName);
  if (!storageKey) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const data = await readRecruitingCv(storageKey);
  if (!data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return new Response(data, {
    headers: {
      "Content-Type": cvMime(storageKey),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(displayName)}`,
      "Content-Length": String(data.length),
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(request: Request, context: Context) {
  try {
    const actor = await recruitingActor();
    if (!actor) return NextResponse.json({ error: "FORBIDDEN", message: "Not allowed." }, { status: 403 });
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "NOT_FOUND", message: "Application not found." }, { status: 404 });
    const locale = new URL(request.url).searchParams.get("locale") ?? "";
    const form = await request.formData().catch(() => null);
    const cv = form?.get("cv");
    if (!(cv && typeof cv === "object" && "arrayBuffer" in cv && Number((cv as File).size) > 0)) {
      return NextResponse.json({ error: "INVALID_CV", message: "Choose a CV file (PDF, DOC or DOCX, max 8 MB)." }, { status: 400 });
    }
    const saved = await saveRecruitingCv(cv as File);
    if (!saved) return NextResponse.json({ error: "INVALID_CV", message: "CV must be PDF, DOC or DOCX (max 8 MB)." }, { status: 400 });
    const cvFileName = packCvRef(saved.storageKey, saved.originalName);
    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.recruitingApplication.findFirst({
        where: { id, hotelTenantId: actor.hotel_tenant_id },
      });
      if (!before) return null;
      const after = await tx.recruitingApplication.update({
        where: { id },
        data: { cvFileName },
        include: { job: jobInclude },
      });
      const previous = unpackCvRef(before.cvFileName);
      if (previous.storageKey) await deleteRecruitingCv(previous.storageKey);
      await recordAuditLog(tx, {
        hotelTenantId: actor.hotel_tenant_id,
        actorId: actor.id,
        action: "UPDATE",
        entityType: "RECRUITING_APPLICATION",
        entityId: id,
        changes: { before: { cvFileName: before.cvFileName }, after: { cvFileName } },
      });
      return after;
    });
    if (!updated) return NextResponse.json({ error: "NOT_FOUND", message: "Application not found." }, { status: 404 });
    return NextResponse.json({ application: toPublicApplicant(updated, updated.job, locale) });
  } catch (error) {
    console.error("CV upload failed", error);
    return NextResponse.json({
      error: "UPLOAD_FAILED",
      message: error instanceof Error ? error.message : "CV upload failed.",
    }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const actor = await recruitingActor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.recruitingApplication.findFirst({
      where: { id, hotelTenantId: actor.hotel_tenant_id },
    });
    if (!before) return null;
    const after = await tx.recruitingApplication.update({
      where: { id },
      data: { cvFileName: "" },
      include: { job: jobInclude },
    });
    const previous = unpackCvRef(before.cvFileName);
    if (previous.storageKey) await deleteRecruitingCv(previous.storageKey);
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "UPDATE",
      entityType: "RECRUITING_APPLICATION",
      entityId: id,
      changes: { before: { cvFileName: before.cvFileName }, after: { cvFileName: "" } },
    });
    return after;
  });
  if (!updated) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ application: toPublicApplicant(updated, updated.job, locale) });
}

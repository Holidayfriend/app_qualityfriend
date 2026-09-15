import { NextResponse } from "next/server";
import { Prisma } from "../../../../../../../app/generated/prisma/client";
import { recordAuditLog } from "../../../../../../../lib/audit/audit-service";
import { recruitingActor } from "../../../../../../../lib/recruiting/access";
import {
  isUuid,
  notesPayload,
  parseApplicationNotes,
} from "../../../../../../../lib/recruiting/application-fields";
import {
  deleteRecruitingExtraFile,
  fileMime,
  readRecruitingExtraFile,
} from "../../../../../../../lib/recruiting/cv-storage";
import { prisma } from "../../../../../../../lib/prisma";

type Context = { params: Promise<{ id: string; fileId: string }> };

export async function GET(_request: Request, context: Context) {
  const actor = await recruitingActor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN", message: "Not allowed." }, { status: 403 });
  const { id, fileId } = await context.params;
  if (!isUuid(id) || !isUuid(fileId)) return NextResponse.json({ error: "NOT_FOUND", message: "File not found." }, { status: 404 });
  const application = await prisma.recruitingApplication.findFirst({
    where: { id, hotelTenantId: actor.hotel_tenant_id },
    select: { notes: true },
  });
  if (!application) return NextResponse.json({ error: "NOT_FOUND", message: "File not found." }, { status: 404 });
  const file = parseApplicationNotes(application.notes).files.find((entry) => entry.id === fileId);
  if (!file) return NextResponse.json({ error: "NOT_FOUND", message: "File not found." }, { status: 404 });
  const data = await readRecruitingExtraFile(file.storageKey);
  if (!data) return NextResponse.json({ error: "NOT_FOUND", message: "File is missing on disk." }, { status: 404 });
  return new Response(data, {
    headers: {
      "Content-Type": file.mimeType || fileMime(file.storageKey),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Content-Length": String(data.length),
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const actor = await recruitingActor();
    if (!actor) return NextResponse.json({ error: "FORBIDDEN", message: "Not allowed." }, { status: 403 });
    const { id, fileId } = await context.params;
    if (!isUuid(id) || !isUuid(fileId)) return NextResponse.json({ error: "NOT_FOUND", message: "File not found." }, { status: 404 });

    const application = await prisma.recruitingApplication.findFirst({
      where: { id, hotelTenantId: actor.hotel_tenant_id },
      select: { notes: true },
    });
    if (!application) return NextResponse.json({ error: "NOT_FOUND", message: "File not found." }, { status: 404 });
    const notes = parseApplicationNotes(application.notes);
    const target = notes.files.find((entry) => entry.id === fileId);
    if (!target) return NextResponse.json({ error: "NOT_FOUND", message: "File not found." }, { status: 404 });

    const nextFiles = notes.files.filter((entry) => entry.id !== fileId);
    await prisma.$transaction(async (tx) => {
      await tx.recruitingApplication.update({
        where: { id },
        data: {
          notes: notesPayload(notes.tags, notes.comments, nextFiles) as Prisma.InputJsonValue,
        },
      });
      await recordAuditLog(tx, {
        hotelTenantId: actor.hotel_tenant_id,
        actorId: actor.id,
        action: "DELETE",
        entityType: "RECRUITING_APPLICATION",
        entityId: id,
        changes: { before: { extraFile: { id: fileId, fileName: target.fileName } } },
      });
    });
    await deleteRecruitingExtraFile(target.storageKey);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Extra file delete failed", error);
    return NextResponse.json({
      error: "DELETE_FAILED",
      message: error instanceof Error ? error.message : "Delete failed.",
    }, { status: 500 });
  }
}

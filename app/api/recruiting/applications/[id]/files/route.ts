import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "../../../../../../app/generated/prisma/client";
import { recordAuditLog } from "../../../../../../lib/audit/audit-service";
import { recruitingActor } from "../../../../../../lib/recruiting/access";
import {
  isUuid,
  notesPayload,
  parseApplicationNotes,
  type ApplicationExtraFile,
} from "../../../../../../lib/recruiting/application-fields";
import {
  extraFileDownloadUrl,
  saveRecruitingExtraFile,
} from "../../../../../../lib/recruiting/cv-storage";
import { prisma } from "../../../../../../lib/prisma";

type Context = { params: Promise<{ id: string }> };

function isUpload(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value && "name" in value && "size" in value && Number((value as File).size) > 0);
}

export async function GET(_request: Request, context: Context) {
  const actor = await recruitingActor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN", message: "Not allowed." }, { status: 403 });
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "NOT_FOUND", message: "Application not found." }, { status: 404 });
  const application = await prisma.recruitingApplication.findFirst({
    where: { id, hotelTenantId: actor.hotel_tenant_id },
    select: { id: true, notes: true },
  });
  if (!application) return NextResponse.json({ error: "NOT_FOUND", message: "Application not found." }, { status: 404 });
  const notes = parseApplicationNotes(application.notes);
  const files = notes.files.map((file) => ({
    id: file.id,
    fileName: file.fileName,
    mimeType: file.mimeType,
    url: file.url || extraFileDownloadUrl(id, file.id),
    createdAt: file.createdAt,
  }));
  return NextResponse.json({ files }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: Context) {
  try {
    const actor = await recruitingActor();
    if (!actor) return NextResponse.json({ error: "FORBIDDEN", message: "Not allowed." }, { status: 403 });
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "NOT_FOUND", message: "Application not found." }, { status: 404 });

    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "INVALID_FILE", message: "No form data received." }, { status: 400 });

    const files = form.getAll("file").filter(isUpload);
    if (!files.length) {
      return NextResponse.json({
        error: "INVALID_FILE",
        message: "Choose a PDF, Word, or image file (max 8 MB).",
      }, { status: 400 });
    }

    const application = await prisma.recruitingApplication.findFirst({
      where: { id, hotelTenantId: actor.hotel_tenant_id },
      select: { id: true, notes: true },
    });
    if (!application) return NextResponse.json({ error: "NOT_FOUND", message: "Application not found." }, { status: 404 });

    const notes = parseApplicationNotes(application.notes);
    const created: ApplicationExtraFile[] = [];
    const rejected: string[] = [];

    for (const file of files.slice(0, 20)) {
      const saved = await saveRecruitingExtraFile(file);
      if (!saved) {
        rejected.push(file.name || "file");
        continue;
      }
      const fileId = randomUUID();
      created.push({
        id: fileId,
        fileName: saved.originalName,
        storageKey: saved.storageKey,
        mimeType: saved.mimeType,
        url: extraFileDownloadUrl(id, fileId),
        createdAt: new Date().toISOString(),
      });
    }

    if (!created.length) {
      return NextResponse.json({
        error: "INVALID_FILE",
        message: rejected.length
          ? `Could not accept: ${rejected.join(", ")}. Use PDF, DOC, DOCX, PNG, JPG, WEBP or GIF (max 8 MB).`
          : "Choose a PDF, Word, or image file (max 8 MB).",
      }, { status: 400 });
    }

    const nextFiles = [...created, ...notes.files].slice(0, 100);
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
        action: "UPDATE",
        entityType: "RECRUITING_APPLICATION",
        entityId: id,
        changes: { after: { extraFiles: created.map((file) => file.fileName) } },
      });
    });

    return NextResponse.json({
      files: created.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        mimeType: file.mimeType,
        url: file.url,
        createdAt: file.createdAt,
      })),
      rejected,
    }, { status: 201 });
  } catch (error) {
    console.error("Extra file upload failed", error);
    return NextResponse.json({
      error: "UPLOAD_FAILED",
      message: error instanceof Error ? error.message : "Upload failed.",
    }, { status: 500 });
  }
}

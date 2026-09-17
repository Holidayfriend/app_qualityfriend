import { splitManualText } from "./chunk";
import { extractManualText } from "./extract";
import { createJobPrisma } from "../jobs/prisma";

export type ManualIndexJob = { hotelTenantId: string; documentId: string };

export async function indexManualDocument(data: ManualIndexJob) {
  const prisma = createJobPrisma(2);
  try {
    const document = await prisma.manualDocument.findFirst({
      where: { id: data.documentId, hotelTenantId: data.hotelTenantId },
      select: { id: true, storageKey: true, mimeType: true, departmentId: true, hotelTenantId: true },
    });
    if (!document) throw new Error("Manual document not found");
    await prisma.manualDocument.update({ where: { id: document.id }, data: { indexStatus: "RUNNING", indexError: null } });
    const text = await extractManualText(document.storageKey, document.mimeType);
    const chunks = splitManualText(text);
    await prisma.$transaction(async (tx) => {
      await tx.manualChunk.deleteMany({ where: { documentId: document.id } });
      if (chunks.length) {
        await tx.manualChunk.createMany({
          data: chunks.map((chunk) => ({
            id: chunk.id,
            hotelTenantId: document.hotelTenantId,
            documentId: document.id,
            departmentId: document.departmentId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
          })),
        });
      }
      await tx.manualDocument.update({
        where: { id: document.id },
        data: { indexStatus: chunks.length ? "READY" : "FAILED", indexError: chunks.length ? null : "No extractable text" },
      });
    });
    return { documentId: document.id, chunks: chunks.length };
  } catch (error) {
    await prisma.manualDocument.updateMany({
      where: { id: data.documentId, hotelTenantId: data.hotelTenantId },
      data: { indexStatus: "FAILED", indexError: error instanceof Error ? error.message.slice(0, 500) : "Index failed" },
    });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

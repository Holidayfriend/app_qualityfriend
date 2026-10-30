import type { PrismaClient } from "../../app/generated/prisma/client";

const KEY = /^[0-9a-f-]{36}\.(pdf|doc|docx|txt)$/i;

type BlobDb = Pick<PrismaClient, "manualFileBlob">;

export async function saveManualBlob(prisma: BlobDb, storageKey: string, bytes: Buffer) {
  await prisma.manualFileBlob.create({ data: { storageKey, bytes } });
}

export async function readManualBlob(prisma: BlobDb, storageKey: string) {
  if (!KEY.test(storageKey)) return null;
  const row = await prisma.manualFileBlob.findUnique({ where: { storageKey }, select: { bytes: true } });
  if (!row?.bytes?.byteLength) return null;
  return Buffer.from(row.bytes);
}

export async function deleteManualBlob(prisma: BlobDb, storageKey: string) {
  if (!KEY.test(storageKey)) return;
  await prisma.manualFileBlob.deleteMany({ where: { storageKey } });
}

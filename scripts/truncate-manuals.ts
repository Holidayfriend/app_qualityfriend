import { config } from "dotenv";
import { rm } from "node:fs/promises";
import path from "node:path";
import { createJobPrisma } from "../lib/jobs/prisma";

config();

async function main() {
  const prisma = createJobPrisma(2);
  try {
    const deletedChunks = await prisma.manualChunk.deleteMany();
    const deletedDocs = await prisma.manualDocument.deleteMany();
    const deletedNotes = await prisma.notification.deleteMany({ where: { moduleKey: "manuals" } });
    const folder = path.join(process.cwd(), "storage", "manuals");
    await rm(folder, { recursive: true, force: true });
    console.log(JSON.stringify({ deletedChunks: deletedChunks.count, deletedDocs: deletedDocs.count, deletedNotes: deletedNotes.count, folder }));
  } finally {
    await prisma.$disconnect();
  }
}

void main();

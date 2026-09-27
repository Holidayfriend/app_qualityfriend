import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ChatMessageType } from "../../app/generated/prisma/enums";
import { prisma } from "../prisma";

export const chatAttachmentLimit = 25 * 1024 * 1024;

const messageSelect = {
  id: true,
  senderId: true,
  type: true,
  text: true,
  attachmentName: true,
  attachmentMime: true,
  attachmentSize: true,
  createdAt: true,
  sender: { select: { firstName: true, lastName: true } },
} as const;

export function attachmentType(mime: string): ChatMessageType {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "VOICE";
  return "DOCUMENT";
}

export function serializeChannelMessage(message: {
  id: string;
  senderId: string;
  type: ChatMessageType;
  text: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentSize: number | null;
  createdAt: Date;
  sender: { firstName: string; lastName: string };
}) {
  return {
    id: message.id,
    sender_id: message.senderId,
    sender_name: `${message.sender.firstName} ${message.sender.lastName}`.trim(),
    type: message.type,
    text: message.text,
    attachment_name: message.attachmentName,
    attachment_mime: message.attachmentMime,
    attachment_size: message.attachmentSize,
    created_at: message.createdAt,
  };
}

export async function saveChatFile(hotelTenantId: string, attachment: File) {
  if (attachment.size > chatAttachmentLimit) return { error: "FILE_TOO_LARGE" as const };
  const directory = path.join(process.cwd(), "storage", "chat", hotelTenantId);
  await mkdir(directory, { recursive: true });
  const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${randomUUID()}-${safeName}`;
  await writeFile(path.join(directory, filename), Buffer.from(await attachment.arrayBuffer()));
  return {
    file: {
      path: path.join(hotelTenantId, filename),
      name: attachment.name,
      mime: attachment.type || "application/octet-stream",
      size: attachment.size,
      type: attachmentType(attachment.type),
    },
  };
}

export async function readChannelMessages(where: { hotelTenantId: string; teamId?: string; departmentId?: string }, before: string | null) {
  const messages = await prisma.chatMessage.findMany({
    where: { ...where, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: messageSelect,
  });
  return { messages: messages.reverse().map(serializeChannelMessage), hasMore: messages.length === 30 };
}

export async function createChannelMessage(input: {
  hotelTenantId: string;
  senderId: string;
  teamId?: string;
  departmentId?: string;
  form: FormData;
}) {
  const text = String(input.form.get("text") ?? "").trim();
  const attachment = input.form.get("attachment");
  let file: { path: string; name: string; mime: string; size: number; type: ChatMessageType } | null = null;
  if (attachment instanceof File && attachment.size) {
    const saved = await saveChatFile(input.hotelTenantId, attachment);
    if ("error" in saved) return { error: saved.error, status: 400 as const };
    file = saved.file;
  }
  if (!text && !file) return { error: "EMPTY_MESSAGE" as const, status: 400 as const };
  const message = await prisma.chatMessage.create({
    data: {
      hotelTenantId: input.hotelTenantId,
      senderId: input.senderId,
      teamId: input.teamId ?? null,
      departmentId: input.departmentId ?? null,
      type: file?.type ?? "TEXT",
      text: text || null,
      attachmentPath: file?.path ?? null,
      attachmentName: file?.name ?? null,
      attachmentMime: file?.mime ?? null,
      attachmentSize: file?.size ?? null,
    },
    select: messageSelect,
  });
  return { message: serializeChannelMessage(message), status: 201 as const };
}

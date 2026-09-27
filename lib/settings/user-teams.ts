import type { Prisma } from "../../app/generated/prisma/client";
import { prisma } from "../prisma";

export function parseTeamIds(body: Record<string, unknown> | null) {
  const raw = body?.teamIds;
  const ids = Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
  if (!ids.length && typeof body?.teamId === "string" && body.teamId) ids.push(body.teamId);
  return [...new Set(ids)];
}

export async function acceptedTeamIds(hotelTenantId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await prisma.team.findMany({ where: { id: { in: ids }, hotelTenantId, isDeleted: false }, select: { id: true } });
  return rows.length === ids.length ? ids : null;
}

export async function replaceUserTeams(tx: Prisma.TransactionClient, userId: string, teamIds: string[]) {
  await tx.userTeam.deleteMany({ where: { userId } });
  if (teamIds.length) await tx.userTeam.createMany({ data: teamIds.map((teamId) => ({ userId, teamId })) });
  return teamIds[0] ?? null;
}

import { prisma } from "../prisma";

function groupPreview(message: { text: string | null; attachmentName: string | null; sender: { firstName: string } } | null) {
  if (!message) return null;
  return `${message.sender.firstName}: ${message.text ?? message.attachmentName ?? ""}`.trim();
}

const none = "00000000-0000-0000-0000-000000000000";

export async function chatDirectory(userId: string, hotelTenantId: string, role: string) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      departmentId: true,
      departmentMemberships: { where: { department: { isDeleted: false } }, select: { departmentId: true } },
      teamMemberships: { select: { teamId: true } },
    },
  });
  const teamIds = me?.teamMemberships.map((membership) => membership.teamId) ?? [];
  const departmentIds = me?.departmentMemberships.map((membership) => membership.departmentId) ?? [];
  if (!departmentIds.length && me?.departmentId) departmentIds.push(me.departmentId);
  const admin = role === "ADMIN";
  const [users, teams, departments] = await Promise.all([
    prisma.user.findMany({
      where: { hotelTenantId, id: { not: userId }, isActive: true, isDeleted: false },
      select: { id: true, firstName: true, lastName: true, role: true, hotelRole: { select: { nameEn: true, nameDe: true, nameIt: true } }, lastSeenAt: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.team.findMany({
      where: { hotelTenantId, isActive: true, isDeleted: false, ...(admin ? {} : { id: { in: teamIds.length ? teamIds : [none] } }) },
      select: {
        id: true,
        nameEn: true,
        nameDe: true,
        nameIt: true,
        memberships: { where: { user: { isActive: true, isDeleted: false } }, select: { userId: true } },
        chatReads: { where: { userId }, select: { lastReadAt: true }, take: 1 },
      },
      orderBy: { nameEn: "asc" },
    }),
    prisma.department.findMany({
      where: { hotelTenantId, isActive: true, isDeleted: false, ...(admin ? {} : { id: { in: departmentIds.length ? departmentIds : [none] } }) },
      select: {
        id: true,
        nameEn: true,
        nameDe: true,
        nameIt: true,
        memberships: { where: { user: { isActive: true, isDeleted: false } }, select: { userId: true } },
        chatReads: { where: { userId }, select: { lastReadAt: true }, take: 1 },
      },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  const enrichedUsers = await Promise.all(users.map(async (user) => {
    const [last, unread] = await Promise.all([
      prisma.chatMessage.findFirst({
        where: { hotelTenantId, OR: [{ senderId: userId, recipientId: user.id }, { senderId: user.id, recipientId: userId }] },
        orderBy: { createdAt: "desc" },
        select: { text: true, attachmentName: true, createdAt: true },
      }),
      prisma.chatMessage.count({ where: { senderId: user.id, recipientId: userId, readAt: null } }),
    ]);
    return {
      kind: "user" as const,
      id: user.id,
      first_name: user.firstName,
      last_name: user.lastName,
      role: user.role,
      role_names: { en: user.hotelRole.nameEn, de: user.hotelRole.nameDe, it: user.hotelRole.nameIt },
      last_seen_at: user.lastSeenAt,
      is_online: Boolean(user.lastSeenAt && user.lastSeenAt.getTime() > Date.now() - 90_000),
      last_message: last?.text ?? last?.attachmentName ?? null,
      last_message_at: last?.createdAt ?? null,
      unread_count: unread,
    };
  }));
  enrichedUsers.sort((a, b) => (b.last_message_at?.getTime() ?? 0) - (a.last_message_at?.getTime() ?? 0) || a.first_name.localeCompare(b.first_name));

  const enrichedTeams = await enrichGroups(teams, hotelTenantId, userId, "team", teamIds);
  const enrichedDepartments = await enrichGroups(departments, hotelTenantId, userId, "department", departmentIds);
  return { currentUserId: userId, users: enrichedUsers, teams: enrichedTeams, departments: enrichedDepartments };
}

async function enrichGroups<T extends {
  id: string;
  nameEn: string;
  nameDe: string;
  nameIt: string;
  memberships?: { userId: string }[];
  members?: { id: string }[];
  chatReads: { lastReadAt: Date }[];
}>(rows: T[], hotelTenantId: string, userId: string, kind: "team" | "department", ownIds: string[]) {
  const enriched = await Promise.all(rows.map(async (row) => {
    const readAt = row.chatReads[0]?.lastReadAt;
    const where = kind === "team" ? { hotelTenantId, teamId: row.id } : { hotelTenantId, departmentId: row.id };
    const [last, unread] = await Promise.all([
      prisma.chatMessage.findFirst({
        where,
        orderBy: { createdAt: "desc" },
        select: { text: true, attachmentName: true, createdAt: true, sender: { select: { firstName: true } } },
      }),
      prisma.chatMessage.count({
        where: { ...where, senderId: { not: userId }, ...(readAt ? { createdAt: { gt: readAt } } : {}) },
      }),
    ]);
    return {
      kind,
      id: row.id,
      name_en: row.nameEn,
      name_de: row.nameDe,
      name_it: row.nameIt,
      member_count: row.memberships?.length ?? row.members?.length ?? 0,
      is_member: ownIds.includes(row.id),
      last_message: groupPreview(last),
      last_message_at: last?.createdAt ?? null,
      unread_count: unread,
    };
  }));
  enriched.sort((a, b) => a.name_en.localeCompare(b.name_en, "en", { sensitivity: "base" }));
  return enriched;
}

export async function unreadChatCount(userId: string, hotelTenantId: string, role: string) {
  const admin = role === "ADMIN";
  const [direct, teamRows, departmentRows] = await Promise.all([
    prisma.chatMessage.count({ where: { hotelTenantId, recipientId: userId, readAt: null } }),
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM chat_messages m
      JOIN teams t ON t.id = m.team_id
      LEFT JOIN team_chat_reads r ON r.team_id = m.team_id AND r.user_id = CAST(${userId} AS uuid)
      WHERE m.hotel_tenant_id = CAST(${hotelTenantId} AS uuid)
        AND t.is_active = true
        AND t.is_deleted = false
        AND m.sender_id <> CAST(${userId} AS uuid)
        AND (${admin} OR m.team_id IN (SELECT team_id FROM user_teams WHERE user_id = CAST(${userId} AS uuid)))
        AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM chat_messages m
      JOIN departments d ON d.id = m.department_id
      LEFT JOIN department_chat_reads r ON r.department_id = m.department_id AND r.user_id = CAST(${userId} AS uuid)
      WHERE m.hotel_tenant_id = CAST(${hotelTenantId} AS uuid)
        AND d.is_active = true
        AND d.is_deleted = false
        AND m.sender_id <> CAST(${userId} AS uuid)
        AND (${admin} OR m.department_id IN (SELECT department_id FROM user_departments WHERE user_id = CAST(${userId} AS uuid)) OR m.department_id = (SELECT department_id FROM users WHERE id = CAST(${userId} AS uuid)))
        AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
    `,
  ]);
  return direct + Number(teamRows[0]?.count ?? 0) + Number(departmentRows[0]?.count ?? 0);
}

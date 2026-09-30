import { notFound, redirect } from "next/navigation";
import { RoleNameForm } from "../../../../../components/settings/role-name-form";
import { prisma } from "../../../../../lib/prisma";
import { roleAdministrator } from "../../../../../lib/settings/hotel-roles";

export default async function EditRolePage({ params }: { params: Promise<{ key: string }> }) {
  const actor = await roleAdministrator();
  if (!actor) redirect("/access-denied");
  const { key } = await params;
  const role = await prisma.hotelRole.findUnique({ where: { hotelTenantId_key: { hotelTenantId: actor.hotelTenantId, key } } });
  if (!role) notFound();
  if (role.isSystem) redirect("/settings/roles");
  return <RoleNameForm role={{ key: role.key, nameEn: role.nameEn, nameDe: role.nameDe, nameIt: role.nameIt, isSystem: role.isSystem }} />;
}

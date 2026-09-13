"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "../../../../../lib/auth/module-access";
import { prisma } from "../../../../../lib/prisma";
import { recordAuditLog } from "../../../../../lib/audit/audit-service";

export type CreateFloorState = { error: string | null };

export async function createFloor(_: CreateFloorState, formData: FormData): Promise<CreateFloorState> {
  const actor = await requireModuleAccess("housekeeping");
  const value = formData.get("code");
  const code = typeof value === "string" ? value.trim() : "";

  if (!code || code.length > 40) return { error: "Enter a floor code of up to 40 characters." };

  try {
    await prisma.$transaction(async tx => {
    const floor = await tx.floor.create({
      data: {
        hotelTenantId: actor.hotel_tenant_id,
        code,
        nameEn: "",
      },
    });
    await recordAuditLog(tx, { hotelTenantId: actor.hotel_tenant_id, actorId: actor.id, action: "CREATE", entityType: "FLOOR", entityId: floor.id, changes: { after: { en: floor.code, de: floor.code, it: floor.code, code: floor.code } } });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return { error: "This floor code already exists." };
    }
    throw error;
  }

  revalidatePath("/housekeeping/settings/floors");
  revalidatePath("/housekeeping/settings");
  redirect("/housekeeping/settings/floors");
}

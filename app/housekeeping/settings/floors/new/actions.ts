"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "../../../../../lib/auth/module-access";
import { prisma } from "../../../../../lib/prisma";

export type CreateFloorState = { error: string | null };

export async function createFloor(_: CreateFloorState, formData: FormData): Promise<CreateFloorState> {
  const actor = await requireModuleAccess("housekeeping");
  const value = formData.get("code");
  const code = typeof value === "string" ? value.trim() : "";

  if (!code || code.length > 40) return { error: "Enter a floor code of up to 40 characters." };

  try {
    await prisma.floor.create({
      data: {
        hotelTenantId: actor.hotel_tenant_id,
        code,
        nameEn: "",
      },
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return { error: "This floor code already exists." };
    }
    throw error;
  }

  revalidatePath("/housekeeping/settings/floors");
  redirect("/housekeeping/settings/floors");
}

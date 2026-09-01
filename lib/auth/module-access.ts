import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "../prisma";
import { getSessionUserId } from "./session";

export const moduleKeys=["dashboard","aiAssistant","chat","mcp","handovers","tasks","housekeeping","repairs","notes","schedule","recruiting","manuals","budget","revenue","competitors","users","departmentTeams","roles","activityLog","recycleBin"] as const;
export type ModuleKey=typeof moduleKeys[number]|"settings";
export type AccessUser={id:string;hotel_tenant_id:string;role:"EMPLOYEE"|"TEAM_LEAD"|"MANAGEMENT"|"ADMIN"};
const defaults:Record<"EMPLOYEE"|"TEAM_LEAD"|"MANAGEMENT",Set<string>>={
 EMPLOYEE:new Set(["dashboard","aiAssistant","chat","handovers","tasks","housekeeping","repairs","notes","manuals","activityLog","recycleBin","settings"]),
 TEAM_LEAD:new Set(["dashboard","aiAssistant","chat","handovers","tasks","housekeeping","repairs","notes","schedule","manuals","activityLog","recycleBin","settings"]),
 MANAGEMENT:new Set(["dashboard","aiAssistant","chat","handovers","tasks","housekeeping","repairs","notes","schedule","manuals","budget","revenue","competitors","activityLog","recycleBin","settings"]),
};
export async function currentAccessUser(){const id=await getSessionUserId();if(!id)return null;const user=await prisma.user.findFirst({where:{id,isActive:true,isDeleted:false},select:{id:true,hotelTenantId:true,role:true,hotelTenant:{select:{subscriptionStatus:true}}}});if(user&&user.hotelTenant.subscriptionStatus!=="ACTIVE")redirect("/billing/subscribe");return user?{id:user.id,hotel_tenant_id:user.hotelTenantId,role:user.role}:null}
export async function accessibleModules(user:AccessUser){if(user.role==="ADMIN")return [...moduleKeys,"settings"];const permissions=await prisma.roleModulePermission.findMany({where:{hotelTenantId:user.hotel_tenant_id,role:user.role},select:{moduleKey:true,canView:true}});const access=new Set(defaults[user.role]);for(const item of permissions){if(item.canView)access.add(item.moduleKey);else access.delete(item.moduleKey)}return [...access]}
export async function requireModuleAccess(module:ModuleKey){const user=await currentAccessUser();if(!user)redirect("/login");if(user.role==="ADMIN")return user;if(module==="settings")redirect("/access-denied");if(!(await accessibleModules(user)).includes(module))redirect("/access-denied");return user}

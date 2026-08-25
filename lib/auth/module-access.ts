import "server-only";
import { redirect } from "next/navigation";
import { queryDatabase } from "../../database";
import { getSessionUserId } from "./session";

export const moduleKeys=["dashboard","aiAssistant","chat","mcp","handovers","tasks","housekeeping","repairs","notes","schedule","recruiting","manuals","budget","revenue","competitors","users","departmentTeams","roles","activityLog","recycleBin"] as const;
export type ModuleKey=typeof moduleKeys[number]|"settings";
export type AccessUser={id:string;hotel_tenant_id:string;role:"EMPLOYEE"|"TEAM_LEAD"|"MANAGEMENT"|"ADMIN"};
const defaults:Record<"EMPLOYEE"|"TEAM_LEAD"|"MANAGEMENT",Set<string>>={
 EMPLOYEE:new Set(["dashboard","aiAssistant","chat","handovers","tasks","housekeeping","repairs","notes","manuals","activityLog","recycleBin","settings"]),
 TEAM_LEAD:new Set(["dashboard","aiAssistant","chat","handovers","tasks","housekeeping","repairs","notes","schedule","manuals","activityLog","recycleBin","settings"]),
 MANAGEMENT:new Set(["dashboard","aiAssistant","chat","handovers","tasks","housekeeping","repairs","notes","schedule","manuals","budget","revenue","competitors","activityLog","recycleBin","settings"]),
};
export async function currentAccessUser(){const id=await getSessionUserId();if(!id)return null;const r=await queryDatabase<AccessUser>(`SELECT id,hotel_tenant_id,role FROM users WHERE id=$1 AND is_active=true AND is_deleted=false LIMIT 1`,[id]);return r.rows[0]??null}
export async function accessibleModules(user:AccessUser){if(user.role==="ADMIN")return [...moduleKeys,"settings"];const r=await queryDatabase<{module_key:string;can_view:boolean}>(`SELECT module_key,can_view FROM role_module_permissions WHERE hotel_tenant_id=$1 AND role=$2::"UserRole"`,[user.hotel_tenant_id,user.role]);const access=new Set(defaults[user.role]);for(const row of r.rows){if(row.can_view)access.add(row.module_key);else access.delete(row.module_key)}return [...access]}
export async function requireModuleAccess(module:ModuleKey){const user=await currentAccessUser();if(!user)redirect("/login");if(user.role==="ADMIN")return user;if(module==="settings")redirect("/access-denied");if(!(await accessibleModules(user)).includes(module))redirect("/access-denied");return user}

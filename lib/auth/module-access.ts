import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "../prisma";
import { getSessionUserId } from "./session";

import { moduleKeys, resolveRoleModules, type ModuleKey } from "./role-policy";
export { moduleKeys, type ModuleKey } from "./role-policy";
export type AccessUser={id:string;hotel_tenant_id:string;role:string};
export async function currentAccessUser(){const id=await getSessionUserId();if(!id)return null;const user=await prisma.user.findFirst({where:{id,isActive:true,isDeleted:false},select:{id:true,hotelTenantId:true,role:true,hotelTenant:{select:{subscriptionStatus:true}}}});if(user&&!(["ACTIVE","COMPED"] as string[]).includes(user.hotelTenant.subscriptionStatus))redirect("/billing/subscribe");return user?{id:user.id,hotel_tenant_id:user.hotelTenantId,role:user.role}:null}
export async function accessibleModules(user:AccessUser){if(user.role==="ADMIN")return [...moduleKeys,"settings"];const permissions=await prisma.roleModulePermission.findMany({where:{hotelTenantId:user.hotel_tenant_id,role:user.role},select:{moduleKey:true,canView:true}});return resolveRoleModules(user.role,permissions)}
export async function requireModuleAccess(module:ModuleKey){const user=await currentAccessUser();if(!user)redirect("/login");if(user.role==="ADMIN")return user;if(module==="settings")redirect("/access-denied");if(!(await accessibleModules(user)).includes(module))redirect("/access-denied");return user}
export async function requireAnyModuleAccess(modules:ModuleKey[]){const user=await currentAccessUser();if(!user)redirect("/login");if(user.role==="ADMIN")return user;const access=await accessibleModules(user);if(!modules.some((module)=>access.includes(module)))redirect("/access-denied");return user}

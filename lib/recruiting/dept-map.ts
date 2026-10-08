import type { DeptId } from "../i18n/recruiting-messages";

export function mapDeptId(name: string | undefined | null): DeptId {
  const value = (name || "").toLowerCase();
  if (value.includes("house") || value.includes("zimmer") || value.includes("puliz")) return "housekeeping";
  if (value.includes("kitchen") || value.includes("küche") || value.includes("cucina") || value.includes("koch")) return "kitchen";
  if (value.includes("spa") || value.includes("wellness") || value.includes("sea")) return "seaspa";
  if (value.includes("maint") || value.includes("technik") || value.includes("tecn")) return "maintenance";
  if (value.includes("rest") || value.includes("service") || value.includes("gastro") || value.includes("f&b")) return "restaurant";
  return "reception";
}

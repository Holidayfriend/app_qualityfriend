import "server-only";
import { prisma } from "../prisma";

export async function validCoupon(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const coupon = await prisma.coupon.findUnique({ where: { code: normalized } });
  if (!coupon?.isActive || (coupon.expiresAt && coupon.expiresAt <= new Date()) || (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions)) return null;
  return coupon;
}

export function discountedAmount(original: string, percent: number) {
  return Math.max(0, Math.round(Number(original) * (100 - percent)) / 100).toFixed(2);
}

import { NextResponse } from "next/server";
import { currentBillingHotel } from "../../../../../lib/billing/current-hotel";
import { getPaypalSubscription, paypalPlanId } from "../../../../../lib/billing/paypal";
import { prisma } from "../../../../../lib/prisma";

export async function POST(request: Request) {
  const user = await currentBillingHotel(true);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const subscriptionId = typeof body?.subscriptionId === "string" ? body.subscriptionId.trim() : "";
  if (!subscriptionId) return NextResponse.json({ error: "INVALID_SUBSCRIPTION" }, { status: 400 });
  try {
    const paypal = await getPaypalSubscription(subscriptionId);
    if (paypal.plan_id !== await paypalPlanId() || paypal.custom_id !== user.hotelTenantId) return NextResponse.json({ error: "SUBSCRIPTION_MISMATCH" }, { status: 403 });
    const localStatus = await prisma.$transaction(async (tx) => {
      const hotel = await tx.hotelTenant.findUnique({ where: { id: user.hotelTenantId }, select: { subscriptionStatus: true } });
      const status = hotel?.subscriptionStatus === "ACTIVE" ? "ACTIVE" : "APPROVAL_PENDING";
      await tx.subscription.upsert({
        where: { providerSubscriptionId: paypal.id },
        create: { hotelTenantId: user.hotelTenantId, providerSubscriptionId: paypal.id, providerPlanId: paypal.plan_id, status, payerEmail: paypal.subscriber?.email_address },
        update: { status, payerEmail: paypal.subscriber?.email_address },
      });
      await tx.hotelTenant.update({ where: { id: user.hotelTenantId }, data: { subscriptionStatus: status, paypalSubscriptionId: paypal.id, paypalPlanId: paypal.plan_id } });
      return status;
    });
    return NextResponse.json({ success: true, status: localStatus });
  } catch (error) {
    console.error("Could not verify approved PayPal subscription", error);
    return NextResponse.json({ error: "PAYPAL_UNAVAILABLE" }, { status: 502 });
  }
}

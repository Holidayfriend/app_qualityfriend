import { NextResponse } from "next/server";
import { currentBillingHotel } from "../../../../../lib/billing/current-hotel";
import { createPaypalSubscription, paypalPlanId } from "../../../../../lib/billing/paypal";
import { prisma } from "../../../../../lib/prisma";

export async function POST() {
  const user = await currentBillingHotel(true);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (user.hotelTenant.subscriptionStatus === "ACTIVE") return NextResponse.json({ error: "ALREADY_ACTIVE" }, { status: 409 });
  try {
    const paypal = await createPaypalSubscription(user.hotelTenantId);
    if (!paypal.id || paypal.plan_id !== await paypalPlanId() || paypal.custom_id !== user.hotelTenantId) throw new Error("PayPal returned an invalid subscription.");
    await prisma.$transaction([
      prisma.subscription.upsert({
        where: { providerSubscriptionId: paypal.id },
        create: { hotelTenantId: user.hotelTenantId, providerSubscriptionId: paypal.id, providerPlanId: paypal.plan_id, status: "APPROVAL_PENDING" },
        update: { providerPlanId: paypal.plan_id, status: "APPROVAL_PENDING" },
      }),
      prisma.hotelTenant.update({ where: { id: user.hotelTenantId }, data: { subscriptionStatus: "APPROVAL_PENDING", paypalSubscriptionId: paypal.id, paypalPlanId: paypal.plan_id } }),
    ]);
    return NextResponse.json({ subscriptionId: paypal.id });
  } catch (error) {
    console.error("Could not create PayPal subscription", error);
    return NextResponse.json({ error: "PAYPAL_UNAVAILABLE" }, { status: 502 });
  }
}

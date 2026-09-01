import { NextResponse } from "next/server";
import { currentBillingHotel } from "../../../../lib/billing/current-hotel";
import { paypalConfiguration } from "../../../../lib/billing/paypal";

export async function GET() {
  const user = await currentBillingHotel();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const hotel = user.hotelTenant;
  const configuration = await paypalConfiguration();
  return NextResponse.json({
    status: hotel.subscriptionStatus,
    subscriptionId: hotel.paypalSubscriptionId,
    planId: hotel.paypalPlanId,
    startedAt: hotel.subscriptionStartedAt,
    nextBillingAt: hotel.subscriptionCurrentPeriodEnd,
    cancelledAt: hotel.subscriptionCancelledAt,
    canManage: user.role === "ADMIN",
    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || null,
    environment: process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox",
    price: configuration.price,
    currency: configuration.currency,
  });
}

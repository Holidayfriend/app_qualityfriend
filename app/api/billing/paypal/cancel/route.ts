import { NextResponse } from "next/server";
import { currentBillingHotel } from "../../../../../lib/billing/current-hotel";
import { cancelPaypalSubscription } from "../../../../../lib/billing/paypal";

export async function POST() {
  const user = await currentBillingHotel(true);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const subscriptionId = user.hotelTenant.paypalSubscriptionId;
  if (!subscriptionId) return NextResponse.json({ error: "NO_SUBSCRIPTION" }, { status: 409 });
  try {
    await cancelPaypalSubscription(subscriptionId);
    return NextResponse.json({ success: true, status: "CANCELLATION_PENDING" });
  } catch (error) {
    console.error("Could not cancel PayPal subscription", error);
    return NextResponse.json({ error: "PAYPAL_UNAVAILABLE" }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import type { Prisma } from "../../../generated/prisma/client";
import { getPaypalSubscription, paypalPlanId, verifyPaypalWebhook } from "../../../../lib/billing/paypal";
import { prisma } from "../../../../lib/prisma";

type WebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: Record<string, unknown>;
};

function date(value: unknown) { return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value) : null; }
function paymentDetails(resource: Record<string, unknown>) {
  const amount = resource.amount && typeof resource.amount === "object" ? resource.amount as Record<string, unknown> : null;
  const value = typeof amount?.total === "string" ? amount.total : typeof amount?.value === "string" ? amount.value : null;
  const currency = typeof amount?.currency === "string" ? amount.currency : typeof amount?.currency_code === "string" ? amount.currency_code : null;
  return {
    providerTransactionId: typeof resource.id === "string" ? resource.id : null,
    amount: value && /^\d+(\.\d{1,2})?$/.test(value) ? value : null,
    currencyCode: currency?.slice(0, 3).toUpperCase() || null,
    transactionAt: date(resource.create_time) || date(resource.update_time),
  };
}

export async function POST(request: Request) {
  const event = await request.json().catch(() => null) as WebhookEvent | null;
  if (!event?.id || !event.event_type || !event.resource) return NextResponse.json({ error: "INVALID_EVENT" }, { status: 400 });
  try {
    if (!(await verifyPaypalWebhook(request.headers, event))) return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });

    const resource = event.resource;
    const subscriptionId = typeof resource.id === "string" && event.event_type.startsWith("BILLING.SUBSCRIPTION.")
      ? resource.id
      : typeof resource.billing_agreement_id === "string" ? resource.billing_agreement_id : null;
    let hotelTenantId: string | null = null;
    let verifiedSubscription: Awaited<ReturnType<typeof getPaypalSubscription>> | null = null;

    if (subscriptionId) {
      verifiedSubscription = await getPaypalSubscription(subscriptionId);
      if (verifiedSubscription.plan_id !== await paypalPlanId()) return NextResponse.json({ error: "PLAN_MISMATCH" }, { status: 400 });
      hotelTenantId = verifiedSubscription.custom_id || null;
      if (!hotelTenantId) return NextResponse.json({ error: "MISSING_TENANT" }, { status: 400 });
      const hotel = await prisma.hotelTenant.findUnique({ where: { id: hotelTenantId }, select: { id: true } });
      if (!hotel) return NextResponse.json({ error: "UNKNOWN_TENANT" }, { status: 404 });
    }

    const statusByEvent = {
      "BILLING.SUBSCRIPTION.ACTIVATED": "ACTIVE",
      "BILLING.SUBSCRIPTION.RE-ACTIVATED": "ACTIVE",
      "BILLING.SUBSCRIPTION.SUSPENDED": "SUSPENDED",
      "BILLING.SUBSCRIPTION.CANCELLED": "CANCELLED",
      "BILLING.SUBSCRIPTION.EXPIRED": "EXPIRED",
    } as const;
    const nextStatus = statusByEvent[event.event_type as keyof typeof statusByEvent];
    const transaction = event.event_type.startsWith("PAYMENT.SALE.") ? paymentDetails(resource) : null;

    await prisma.$transaction(async (tx) => {
      await tx.paymentEvent.create({
        data: { providerEventId: event.id!, eventType: event.event_type!, hotelTenantId, payload: event as Prisma.InputJsonValue, ...(transaction || {}) },
      });
      if (subscriptionId && verifiedSubscription && hotelTenantId) {
        const startedAt = date(verifiedSubscription.start_time);
        const nextBillingAt = date(verifiedSubscription.billing_info?.next_billing_time);
        await tx.subscription.upsert({
          where: { providerSubscriptionId: subscriptionId },
          create: {
            hotelTenantId, providerSubscriptionId: subscriptionId, providerPlanId: verifiedSubscription.plan_id,
            status: nextStatus || "APPROVAL_PENDING", payerEmail: verifiedSubscription.subscriber?.email_address,
            startedAt, nextBillingAt, cancelledAt: nextStatus === "CANCELLED" ? new Date() : null,
          },
          update: {
            ...(nextStatus ? { status: nextStatus } : {}), payerEmail: verifiedSubscription.subscriber?.email_address,
            startedAt, nextBillingAt, ...(nextStatus === "CANCELLED" ? { cancelledAt: new Date() } : {}),
          },
        });
        if (nextStatus) {
          await tx.hotelTenant.update({
            where: { id: hotelTenantId },
            data: {
              subscriptionStatus: nextStatus, paypalSubscriptionId: subscriptionId, paypalPlanId: verifiedSubscription.plan_id,
              subscriptionStartedAt: startedAt, subscriptionCurrentPeriodEnd: nextBillingAt,
              ...(nextStatus === "CANCELLED" ? { subscriptionCancelledAt: new Date() } : {}),
            },
          });
        }
      }
      await tx.paymentEvent.update({ where: { providerEventId: event.id! }, data: { processedAt: new Date() } });
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ received: true, duplicate: true });
    console.error("PayPal webhook processing failed", error);
    return NextResponse.json({ error: "WEBHOOK_PROCESSING_FAILED" }, { status: 500 });
  }
}

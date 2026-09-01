import "server-only";
import { prisma } from "../prisma";

type PaypalSubscription = {
  id: string;
  status: string;
  plan_id: string;
  custom_id?: string;
  subscriber?: { email_address?: string };
  start_time?: string;
  billing_info?: { next_billing_time?: string };
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export async function paypalConfiguration() {
  const environment = process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox";
  const stored = await prisma.billingConfiguration.findUnique({ where: { id: `paypal_${environment}` } });
  return {
    productId: stored?.productId || process.env.PAYPAL_PRODUCT_ID?.trim() || null,
    planId: stored?.planId || process.env.PAYPAL_PLAN_ID?.trim() || null,
    price: stored?.monthlyPrice.toFixed(2) || "39.00",
    currency: stored?.currencyCode || "EUR",
  };
}
export async function paypalPlanId() { const id=(await paypalConfiguration()).planId;if(!id)throw new Error("PayPal plan has not been created in the admin billing settings.");return id; }
export function paypalClientId() { return required("PAYPAL_CLIENT_ID"); }
export function paypalWebhookId() { return required("PAYPAL_WEBHOOK_ID"); }
export function paypalBaseUrl() {
  return process.env.PAYPAL_ENVIRONMENT === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function accessToken() {
  const credentials = Buffer.from(`${paypalClientId()}:${required("PAYPAL_CLIENT_SECRET")}`).toString("base64");
  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`PayPal authentication failed (${response.status}).`);
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error("PayPal did not return an access token.");
  return data.access_token;
}

async function paypalRequest<T>(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  const response = await fetch(`${paypalBaseUrl()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("PayPal API request failed", response.status, path, detail.slice(0, 1000));
    throw new Error(`PayPal request failed (${response.status}).`);
  }
  return response.status === 204 ? undefined as T : await response.json() as T;
}

export async function createPaypalSubscription(hotelTenantId: string) {
  const planId = await paypalPlanId();
  return paypalRequest<PaypalSubscription>("/v1/billing/subscriptions", {
    method: "POST",
    headers: { "PayPal-Request-Id": `qualityfriend-${hotelTenantId}-${Date.now()}` },
    body: JSON.stringify({
      plan_id: planId,
      custom_id: hotelTenantId,
      application_context: {
        brand_name: "QualityFriend",
        locale: "en-DE",
        user_action: "SUBSCRIBE_NOW",
        shipping_preference: "NO_SHIPPING",
      },
    }),
  });
}

export async function getPaypalSubscription(subscriptionId: string) {
  return paypalRequest<PaypalSubscription>(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export async function cancelPaypalSubscription(subscriptionId: string) {
  await paypalRequest<void>(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason: "Cancelled by the QualityFriend hotel administrator" }),
  });
}

export async function verifyPaypalWebhook(headers: Headers, event: unknown) {
  const body = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: paypalWebhookId(),
    webhook_event: event,
  };
  if (!body.auth_algo || !body.cert_url || !body.transmission_id || !body.transmission_sig || !body.transmission_time) return false;
  const result = await paypalRequest<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", { method: "POST", body: JSON.stringify(body) });
  return result.verification_status === "SUCCESS";
}

export type { PaypalSubscription };

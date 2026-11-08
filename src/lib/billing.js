import crypto from "node:crypto";
import { withAccounts } from "./auth";

// Stripe's REST API, without the SDK: form-encoded requests, and webhook
// signatures checked by hand.

const API = "https://api.stripe.com/v1";
// Statuses that keep the paid features on. past_due still has Stripe retrying
// the card, so access holds until it gives up and cancels. comp is set by hand
// for accounts that don't pay.
const PAID = new Set(["active", "trialing", "past_due", "comp"]);
const SIGNATURE_TOLERANCE_S = 300;

function form(params, prefix = "", out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object") form(value, name, out);
    else out.append(name, String(value));
  }
  return out;
}

export async function stripe(path, params, method = params ? "POST" : "GET") {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params ? form(params) : undefined,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Stripe ${response.status}: ${body.error?.message ?? "request failed"}`);
  return body;
}

export function isPaid(user) {
  return Boolean(user && PAID.has(user.subscription_status));
}

/** The user's Stripe customer id, making the customer the first time. */
export async function customerFor(user) {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const customer = await stripe("/customers", {
    email: user.email ?? undefined,
    phone: user.phone ?? undefined,
    name: user.name ?? undefined,
    metadata: { user_id: user.id },
  });
  withAccounts((db) => db.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run(customer.id, user.id));
  return customer.id;
}

/** Copy a Stripe subscription onto the account that owns its customer. */
export function saveSubscription(subscription) {
  const end = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end ?? null;
  withAccounts((db) =>
    db
      .prepare("UPDATE users SET subscription_id = ?, subscription_status = ?, current_period_end = ? WHERE stripe_customer_id = ?")
      .run(subscription.id, subscription.status, end, subscription.customer),
  );
}

/** The event in a webhook body, or null when the signature does not check out. */
export function verifyWebhook(raw, header) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return null;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=")));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > SIGNATURE_TOLERANCE_S) return null;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  const given = header
    .split(",")
    .filter((kv) => kv.startsWith("v1="))
    .map((kv) => kv.slice(3));
  const ok = given.some((sig) => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
  return ok ? JSON.parse(raw) : null;
}

import { saveSubscription, stripe, verifyWebhook } from "@/lib/billing";

const SUBSCRIPTION_EVENTS = new Set(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]);

export async function POST(request) {
  const raw = await request.text();
  const event = verifyWebhook(raw, request.headers.get("stripe-signature"));
  if (!event) return new Response("Bad signature", { status: 400 });

  const object = event.data.object;
  try {
    if (SUBSCRIPTION_EVENTS.has(event.type)) saveSubscription(object);
    if (event.type === "checkout.session.completed" && object.subscription) {
      saveSubscription(await stripe(`/subscriptions/${object.subscription}`));
    }
  } catch (err) {
    console.error("Webhook failed:", event.type, err);
    return new Response("Failed", { status: 500 });
  }
  return Response.json({ received: true });
}

import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionUser } from "@/lib/auth";
import { saveSubscription, stripe } from "@/lib/billing";
import { siteOrigin } from "@/lib/site";

// Checkout's return address. Records the subscription right away, so the
// studio opens unlocked without waiting on the webhook.
export async function GET(request) {
  const origin = siteOrigin(request);
  const id = new URL(request.url).searchParams.get("session_id");
  const user = sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
  if (id && user?.stripe_customer_id) {
    try {
      const checkout = await stripe(`/checkout/sessions/${encodeURIComponent(id)}?expand[]=subscription`);
      if (checkout.customer === user.stripe_customer_id && checkout.subscription?.id) saveSubscription(checkout.subscription);
    } catch (err) {
      console.error("Checkout confirm failed:", err);
    }
  }
  return Response.redirect(`${origin}/dashboard?upgraded=1`, 303);
}

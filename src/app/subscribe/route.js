import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionUser } from "@/lib/auth";
import { customerFor, isPaid, stripe } from "@/lib/billing";
import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

// The link the sales script texts: sign in if needed, then straight to
// Stripe Checkout.
export async function GET(request) {
  const origin = siteOrigin(request);
  const user = sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) return Response.redirect(`${origin}/login?method=phone&back=%2Fsubscribe`, 303);
  if (isPaid(user)) return Response.redirect(`${origin}/dashboard`, 303);
  try {
    const checkout = await stripe("/checkout/sessions", {
      mode: "subscription",
      customer: await customerFor(user),
      client_reference_id: user.id,
      line_items: { 0: { price: process.env.STRIPE_PRICE_ID, quantity: 1 } },
      allow_promotion_codes: true,
      success_url: `${origin}/api/billing/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard`,
    });
    return Response.redirect(checkout.url, 303);
  } catch (err) {
    console.error("Subscribe checkout failed:", err);
    return Response.redirect(`${origin}/dashboard?checkout=failed`, 303);
  }
}

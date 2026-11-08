import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionUser } from "@/lib/auth";
import { customerFor, isPaid, stripe } from "@/lib/billing";
import { siteOrigin } from "@/lib/site";

export async function POST(request) {
  const user = sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) return Response.json({ error: "Sign in first.", login: "/login?back=%2Fstudio%3Funlock%3D1" }, { status: 401 });

  const origin = siteOrigin(request);
  try {
    const customer = await customerFor(user);
    if (isPaid(user)) {
      const portal = await stripe("/billing_portal/sessions", { customer, return_url: `${origin}/studio` });
      return Response.json({ url: portal.url });
    }
    const checkout = await stripe("/checkout/sessions", {
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      line_items: { 0: { price: process.env.STRIPE_PRICE_ID, quantity: 1 } },
      allow_promotion_codes: true,
      success_url: `${origin}/api/billing/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/studio?unlock=1`,
    });
    return Response.json({ url: checkout.url });
  } catch (err) {
    console.error("Checkout failed:", err);
    return Response.json({ error: "Checkout couldn't start. Try again in a minute." }, { status: 502 });
  }
}

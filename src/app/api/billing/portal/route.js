import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionUser } from "@/lib/auth";
import { stripe } from "@/lib/billing";
import { siteOrigin } from "@/lib/site";

export async function POST(request) {
  const user = sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user?.stripe_customer_id) return Response.json({ error: "No billing on this account yet." }, { status: 404 });
  try {
    const portal = await stripe("/billing_portal/sessions", { customer: user.stripe_customer_id, return_url: `${siteOrigin(request)}/studio` });
    return Response.json({ url: portal.url });
  } catch (err) {
    console.error("Billing portal failed:", err);
    return Response.json({ error: "Billing couldn't open. Try again in a minute." }, { status: 502 });
  }
}

import { cookies } from "next/headers";
import { accountLabel, SESSION_COOKIE, sessionUser } from "@/lib/auth";
import { isPaid } from "@/lib/billing";

export async function GET() {
  const user = sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) return Response.json({ signedIn: false });
  return Response.json({
    signedIn: true,
    email: user.email,
    phone: user.phone,
    name: user.name,
    label: accountLabel(user),
    paid: isPaid(user),
    billing: Boolean(user.stripe_customer_id),
  });
}

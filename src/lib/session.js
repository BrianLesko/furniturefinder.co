import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionUser } from "./auth";
import { isPaid } from "./billing";

/** The signed-in account for this request, or null. */
export async function currentUser() {
  return sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
}

/** `{ user }` for a subscribed account, else `{ error }`, a response to send. */
export async function paidUser() {
  const user = await currentUser();
  if (!user) return { error: Response.json({ error: "Sign in first.", login: "/login?back=%2Fdashboard" }, { status: 401 }) };
  if (!isPaid(user)) {
    return { error: Response.json({ error: "Subscribe to save rooms and connect your AI.", subscribe: "/subscribe" }, { status: 402 }) };
  }
  return { user };
}

import { cookies } from "next/headers";
import { normalizeEmail, readSession, safeBack, SESSION_COOKIE, startLogin } from "@/lib/auth";
import { sendLoginEmail } from "@/lib/email";
import { siteOrigin } from "@/lib/site";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

  const linkId = body.link ? (readSession((await cookies()).get(SESSION_COOKIE)?.value)?.id ?? null) : null;
  const login = startLogin(email, safeBack(body.back), linkId);
  if (login.error) {
    return Response.json({ error: "A code was just sent. Check your email, or try again in a minute." }, { status: 429 });
  }
  const link = `${siteOrigin(request)}/api/auth/callback?token=${encodeURIComponent(login.token)}`;

  if (process.env.NODE_ENV !== "production") {
    console.log(`\nSign-in link for ${email}:\n${link}\nCode: ${login.code}\n`);
    return Response.json({ sent: true, dev_link: link, dev_code: login.code });
  }
  try {
    await sendLoginEmail(email, link, login.code);
  } catch (err) {
    console.error("Sign-in email failed:", err);
    return Response.json({ error: "We couldn't send the email. Try again in a minute." }, { status: 502 });
  }
  return Response.json({ sent: true });
}

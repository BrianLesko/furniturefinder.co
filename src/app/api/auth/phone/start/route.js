import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { normalizeEmail, phonePendingCookie, readSession, safeBack, SESSION_COOKIE } from "@/lib/auth";
import { secureCookies } from "@/lib/site";
import { startPhoneSignup } from "@/lib/textwork";

// Step one of phone sign in: textwork's signup form wants a name and an
// email, then hands back a code to text in.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const email = normalizeEmail(body.email);
  if (!name) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  if (!email) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const signup = await startPhoneSignup(name, email);
  if (signup.error) return NextResponse.json({ error: signup.error }, { status: signup.status });

  const linkId = body.link ? (readSession((await cookies()).get(SESSION_COOKIE)?.value)?.id ?? null) : null;
  const response = NextResponse.json({ code: signup.code, smsNumber: signup.smsNumber });
  response.cookies.set(phonePendingCookie({ ...signup, name, email: signup.sentEmail, back: safeBack(body.back), linkId }, secureCookies));
  return response;
}

import { NextResponse } from "next/server";
import { checkCode, normalizeEmail, safeBack, sessionCookie, signIn } from "@/lib/auth";
import { secureCookies } from "@/lib/site";

const MESSAGES = {
  expired: "This code has expired. Request a new one.",
  locked: "Too many attempts. Request a new code.",
  invalid: "That code is incorrect. Try again.",
};

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const code = String(body.code ?? "").replace(/\D/g, "");
  if (!email || code.length !== 6) {
    return NextResponse.json({ error: "Enter the 6-digit code from your email." }, { status: 400 });
  }
  const result = checkCode(email, code);
  if (!result.ok) return NextResponse.json({ error: MESSAGES[result.error] }, { status: 400 });

  const response = NextResponse.json({ redirect: safeBack(result.back) });
  response.cookies.set(sessionCookie(signIn(email, result.linkId), secureCookies));
  return response;
}

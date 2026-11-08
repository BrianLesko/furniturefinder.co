import { NextResponse } from "next/server";
import { checkCode, normalizePhone, safeBack, sessionCookie, signInPhone } from "@/lib/auth";
import { secureCookies } from "@/lib/site";

const MESSAGES = {
  expired: "This code has expired. Text yourself a new one.",
  locked: "Too many attempts. Text yourself a new code.",
  invalid: "That code is incorrect. Try again.",
};

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  const code = String(body.code ?? "").replace(/\D/g, "");
  if (!phone || code.length !== 6) {
    return NextResponse.json({ error: "Enter the 6-digit code we texted you." }, { status: 400 });
  }
  const result = checkCode(phone, code);
  if (!result.ok) return NextResponse.json({ error: MESSAGES[result.error] }, { status: 400 });

  const response = NextResponse.json({ redirect: safeBack(result.back) });
  response.cookies.set(sessionCookie(signInPhone(phone, null, result.linkId), secureCookies));
  return response;
}

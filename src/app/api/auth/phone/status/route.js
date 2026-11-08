import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PHONE_COOKIE, readPhonePending, safeBack, sessionCookie, signInPhone } from "@/lib/auth";
import { secureCookies } from "@/lib/site";
import { phoneSignupResult } from "@/lib/textwork";

// Polled by the login page until textwork sees the text.
export async function GET() {
  const pending = readPhonePending((await cookies()).get(PHONE_COOKIE)?.value);
  if (!pending) return NextResponse.json({ status: "expired" });

  const result = await phoneSignupResult(pending.code, pending.email);
  if (result.status !== "verified") return NextResponse.json({ status: result.status });

  const response = NextResponse.json({ status: "verified", redirect: safeBack(pending.back) });
  response.cookies.set(sessionCookie(signInPhone(result.phone, pending.name, pending.linkId), secureCookies));
  response.cookies.set({ name: PHONE_COOKIE, value: "", path: "/api/auth/phone", maxAge: 0 });
  return response;
}

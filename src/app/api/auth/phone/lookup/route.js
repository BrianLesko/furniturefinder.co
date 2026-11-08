import { cookies } from "next/headers";
import { normalizePhone, phoneHasAccount, readSession, safeBack, SESSION_COOKIE, startLogin } from "@/lib/auth";
import { textLoginCode } from "@/lib/textwork";

// Phone sign in starts here. A number with an account gets a code texted to
// it; a new one goes on to textwork's signup form (see ../start).
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  if (!phone) return Response.json({ error: "Enter a valid phone number." }, { status: 400 });
  if (!phoneHasAccount(phone)) return Response.json({ known: false, phone });

  const linkId = body.link ? (readSession((await cookies()).get(SESSION_COOKIE)?.value)?.id ?? null) : null;
  const login = startLogin(phone, safeBack(body.back), linkId);
  if (login.error) {
    return Response.json({ error: "A code was just texted. Check your messages, or try again in a minute." }, { status: 429 });
  }
  if (process.env.NODE_ENV !== "production") {
    console.log(`\nSign-in code for ${phone}: ${login.code}\n`);
    return Response.json({ known: true, phone, dev_code: login.code });
  }
  try {
    await textLoginCode(phone, login.code);
  } catch (err) {
    console.error("Sign-in text failed:", err);
    return Response.json({ error: "We couldn't text the code. Try again in a minute." }, { status: 502 });
  }
  return Response.json({ known: true, phone });
}

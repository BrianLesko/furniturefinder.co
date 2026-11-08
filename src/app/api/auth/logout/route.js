import { SESSION_COOKIE } from "@/lib/auth";
import { secureCookies, siteOrigin } from "@/lib/site";

// POST only, so a link or image on another page cannot sign anyone out.
export async function POST(request) {
  const headers = new Headers({ Location: `${siteOrigin(request)}/` });
  headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureCookies ? "; Secure" : ""}`);
  return new Response(null, { status: 303, headers });
}

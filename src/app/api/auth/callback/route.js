import { readLinkToken, sessionCookie, signIn } from "@/lib/auth";
import { secureCookies, siteOrigin } from "@/lib/site";

export async function GET(request) {
  const origin = siteOrigin(request);
  const link = readLinkToken(new URL(request.url).searchParams.get("token"));
  if (link.error) return Response.redirect(`${origin}/login?error=${link.error}`, 307);

  const headers = new Headers({ Location: `${origin}${link.back}` });
  const cookie = sessionCookie(signIn(link.email, link.linkId), secureCookies);
  headers.append(
    "Set-Cookie",
    `${cookie.name}=${cookie.value}; Path=${cookie.path}; Max-Age=${cookie.maxAge}; HttpOnly; SameSite=Lax${cookie.secure ? "; Secure" : ""}`,
  );
  return new Response(null, { status: 307, headers });
}

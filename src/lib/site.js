const PUBLIC_ORIGIN = "https://furniturefinder.co";

/**
 * Where links and redirects should point. Behind Caddy the request URL is the
 * local port, so production always uses the public origin.
 */
export function siteOrigin(request) {
  return process.env.NODE_ENV === "production" ? PUBLIC_ORIGIN : new URL(request.url).origin;
}

export const secureCookies = process.env.NODE_ENV === "production";

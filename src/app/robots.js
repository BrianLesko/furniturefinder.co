export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/login", "/subscribe", "/add/", "/straighten/vote"] }],
    sitemap: "https://furniturefinder.co/sitemap.xml",
    host: "https://furniturefinder.co",
  };
}

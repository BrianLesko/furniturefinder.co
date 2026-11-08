/** @type {import('next').NextConfig} */
const nextConfig = {
  // DataFast's script and its event endpoint, served first-party (as on
  // textwork.co) so ad blockers that list datafa.st do not drop visits.
  async rewrites() {
    return [
      { source: "/js/script.js", destination: "https://datafa.st/js/script.js" },
      { source: "/api/events", destination: "https://datafa.st/api/events" },
      // Comparison posts are one dynamic page, so their .md mirrors live under it.
      { source: "/blog/:slug([a-z0-9-]+)\\.md", destination: "/blog/:slug/markdown" },
      { source: "/docs/:slug([a-z0-9-]+)\\.md", destination: "/docs/:slug/markdown" },
      { source: "/rooms/:slug([a-z0-9-]+)\\.md", destination: "/rooms/:slug/markdown" },
    ];
  },
};

export default nextConfig;

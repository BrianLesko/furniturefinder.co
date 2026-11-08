import { pricingMarkdown } from "@/content/pricing";

export const dynamic = "force-static";

export function GET() {
  return new Response(pricingMarkdown(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

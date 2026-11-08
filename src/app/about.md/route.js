import { aboutMarkdown } from "@/content/about";

export const dynamic = "force-static";

export function GET() {
  return new Response(aboutMarkdown(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

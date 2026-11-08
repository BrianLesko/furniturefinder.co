import fs from "fs";
import path from "path";

export const dynamic = "force-static";

export function GET() {
  const markdown = fs.readFileSync(path.join(process.cwd(), "src/content/blog/four-houses-full.md"), "utf8");
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

import { comparisonBySlug, comparisonMarkdown, comparisons } from "@/content/blog/comparisons";
import { formatPostDate } from "../../posts";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return comparisons.map(({ slug }) => ({ slug }));
}

export async function GET(_request, { params }) {
  const post = comparisonBySlug((await params).slug);
  if (!post) return new Response("Not found", { status: 404 });
  return new Response(comparisonMarkdown(post, formatPostDate(post.published)), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

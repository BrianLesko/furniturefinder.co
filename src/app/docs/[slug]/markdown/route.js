import { docBySlug, docMarkdown, docs } from "@/content/docs";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return docs.map(({ slug }) => ({ slug }));
}

export async function GET(_request, { params }) {
  const doc = docBySlug((await params).slug);
  if (!doc) return new Response("Not found", { status: 404 });
  return new Response(docMarkdown(doc), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

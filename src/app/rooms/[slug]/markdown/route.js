import { roomBySlug, roomMarkdown, rooms } from "@/content/rooms";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return rooms.map(({ slug }) => ({ slug }));
}

export async function GET(_request, { params }) {
  const room = roomBySlug((await params).slug);
  if (!room) return new Response("Not found", { status: 404 });
  return new Response(roomMarkdown(room), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

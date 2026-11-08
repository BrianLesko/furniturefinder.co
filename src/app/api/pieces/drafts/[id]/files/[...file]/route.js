import { readDraftFile, teamRoute } from "@/lib/pieces";

export const dynamic = "force-dynamic";

export const GET = teamRoute(async (request, { id, file }) => {
  const { bytes, type } = await readDraftFile(id, file.join("/"));
  return new Response(bytes, { headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" } });
});

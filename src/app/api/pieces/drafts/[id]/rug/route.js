import { makeRugViews, teamRoute } from "@/lib/pieces";

export const dynamic = "force-dynamic";

export const POST = teamRoute(async (request, { id }) => {
  const { photoId, kind } = await request.json();
  return makeRugViews(id, String(photoId ?? ""), kind);
});

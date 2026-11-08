import { generateSheet, teamRoute } from "@/lib/pieces";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = teamRoute(async (request, { id }) => {
  const body = await request.json().catch(() => ({}));
  const angles = Array.isArray(body.angles) ? body.angles.map(String) : null;
  return generateSheet(id, { angles });
});

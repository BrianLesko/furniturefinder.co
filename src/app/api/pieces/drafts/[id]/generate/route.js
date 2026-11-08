import { generateView, teamRoute } from "@/lib/pieces";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = teamRoute(async (request, { id }) => {
  const { angle } = await request.json();
  return generateView(id, String(angle ?? ""));
});

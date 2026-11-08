import { buildDraftMesh, deleteDraftMesh, teamRoute } from "@/lib/pieces";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

export const POST = teamRoute(async (request, { id }) => buildDraftMesh(id));

export const DELETE = teamRoute(async (request, { id }) => deleteDraftMesh(id));

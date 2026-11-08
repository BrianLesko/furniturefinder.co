import { deleteDraft, getDraft, teamRoute, updateDraft } from "@/lib/pieces";

export const dynamic = "force-dynamic";

export const GET = teamRoute((request, { id }) => getDraft(id));

export const PATCH = teamRoute(async (request, { id }) => updateDraft(id, await request.json()));

export const DELETE = teamRoute(async (request, { id }) => {
  await deleteDraft(id);
  return { ok: true };
});

import { createDraft, listDrafts, teamRoute } from "@/lib/pieces";

export const dynamic = "force-dynamic";

export const GET = teamRoute(() => ({ drafts: listDrafts() }));

export const POST = teamRoute(async (request) => createDraft(await request.json().catch(() => ({}))));

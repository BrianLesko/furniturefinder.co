import { publishDraft, teamRoute, unpublishDraft } from "@/lib/pieces";

export const dynamic = "force-dynamic";

export const POST = teamRoute((request, { id }) => publishDraft(id));

export const DELETE = teamRoute((request, { id }) => unpublishDraft(id));

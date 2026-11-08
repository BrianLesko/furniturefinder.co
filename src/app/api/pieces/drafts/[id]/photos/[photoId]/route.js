import { deletePhoto, teamRoute, updatePhoto } from "@/lib/pieces";

export const dynamic = "force-dynamic";

export const PATCH = teamRoute(async (request, { id, photoId }) => updatePhoto(id, photoId, await request.json()));

export const DELETE = teamRoute((request, { id, photoId }) => deletePhoto(id, photoId));

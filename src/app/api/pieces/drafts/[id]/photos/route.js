import { addPhotoFromUpload, addPhotoFromUrl, teamRoute } from "@/lib/pieces";

export const dynamic = "force-dynamic";

// JSON {url, angle} for a photo on the web, or multipart {file, angle} for an upload.
export const POST = teamRoute(async (request, { id }) => {
  if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    const form = await request.formData();
    return addPhotoFromUpload(id, form.get("file"), form.get("angle") || null);
  }
  const { url, angle } = await request.json();
  return addPhotoFromUrl(id, { url: String(url ?? ""), angle: angle || null });
});

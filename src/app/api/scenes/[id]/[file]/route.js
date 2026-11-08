import { readFile } from "node:fs/promises";
import path from "node:path";
import { readOwnScene, SCENE_FILES, sceneDir } from "@/lib/scenes";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };

export async function GET(request, { params }) {
  const user = await currentUser();
  const { id, file } = await params;
  const scene = user && (await readOwnScene(id, user.id).catch(() => null));
  const name = file === "source" ? scene?.sourceFile : { room: SCENE_FILES.room, mockup: SCENE_FILES.mockup, mask: scene?.hasMask && SCENE_FILES.mask }[file];
  if (!scene || !name) return new Response("Not found", { status: 404 });
  const data = await readFile(path.join(sceneDir(scene.id), name));
  return new Response(data, {
    headers: { "Content-Type": TYPES[path.extname(name)] ?? "application/octet-stream", "Cache-Control": "private, max-age=60" },
  });
}

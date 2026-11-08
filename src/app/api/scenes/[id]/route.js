import { deleteScene, readOwnScene } from "@/lib/scenes";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const user = await currentUser();
  const { id } = await params;
  const scene = user && (await readOwnScene(id, user.id).catch(() => null));
  if (!scene) return Response.json({ error: "No such room." }, { status: 404 });
  return Response.json({ scene });
}

export async function DELETE(request, { params }) {
  const user = await currentUser();
  const { id } = await params;
  const gone = user && (await deleteScene(id, user.id).catch(() => false));
  if (!gone) return Response.json({ error: "No such room." }, { status: 404 });
  return Response.json({ deleted: true });
}

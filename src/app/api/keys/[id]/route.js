import { revokeApiKey } from "@/lib/auth";
import { currentUser } from "@/lib/session";

export async function DELETE(request, { params }) {
  const user = await currentUser();
  const { id } = await params;
  if (!user || !revokeApiKey(user.id, Number(id))) return Response.json({ error: "No such key." }, { status: 404 });
  return Response.json({ revoked: true });
}

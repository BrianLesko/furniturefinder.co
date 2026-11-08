import { createApiKey, listApiKeys } from "@/lib/auth";
import { currentUser, paidUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const MAX_KEYS = 10;

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  return Response.json({ keys: listApiKeys(user.id) });
}

export async function POST(request) {
  const { user, error } = await paidUser();
  if (error) return error;
  if (listApiKeys(user.id).length >= MAX_KEYS) {
    return Response.json({ error: `You have ${MAX_KEYS} keys. Revoke one to make another.` }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  return Response.json(createApiKey(user.id, body.name));
}

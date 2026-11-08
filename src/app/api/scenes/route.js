import { listScenes, sourceFileFor, writeScene } from "@/lib/scenes";
import { currentUser, paidUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const MAX_BYTES = 60 * 1024 * 1024;
const SIGN_IN = { error: "Sign in to save your rooms.", login: "/login?back=%2Fdashboard" };

async function bytes(form, name, required, types = ["image/png"]) {
  const file = form.get(name);
  if (!file || typeof file === "string") {
    if (required) throw new Error(`Missing ${name}.`);
    return null;
  }
  if (!types.includes(file.type)) throw new Error(`${name} must be ${types.join(" or ")}.`);
  return { data: Buffer.from(await file.arrayBuffer()), type: file.type };
}

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json(SIGN_IN, { status: 401 });
  return Response.json({ scenes: await listScenes({ ownerId: user.id }) });
}

export async function POST(request) {
  const { user, error } = await paidUser();
  if (error) return error;
  if (Number(request.headers.get("content-length")) > MAX_BYTES) {
    return Response.json({ error: "That scene is too large." }, { status: 413 });
  }
  try {
    const form = await request.formData();
    const scene = JSON.parse(String(form.get("scene") ?? ""));
    if (!Array.isArray(scene.items) || !scene.room?.width || !scene.room?.height) {
      throw new Error("The scene needs a room size and a list of items.");
    }
    const source = await bytes(form, "source", false, ["image/jpeg", "image/png", "image/webp"]);
    const record = await writeScene({
      id: String(form.get("id") ?? "") || null,
      ownerId: user.id,
      room: (await bytes(form, "room", true)).data,
      mockup: (await bytes(form, "mockup", true)).data,
      mask: (await bytes(form, "mask", false))?.data ?? null,
      source: source && sourceFileFor(source.type) ? source.data : null,
      sourceType: source?.type,
      scene,
    });
    return Response.json({ id: record.id });
  } catch (err) {
    return Response.json({ error: String(err?.message ?? err) }, { status: 400 });
  }
}

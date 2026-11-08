export const dynamic = "force-dynamic";

const SERVICE = process.env.LAYOUT_SERVICE_URL ?? "http://127.0.0.1:6021";
const MAX_BYTES = 40 * 1024 * 1024;

export async function POST(request) {
  if (Number(request.headers.get("content-length")) > MAX_BYTES) {
    return Response.json({ error: "That photo is too large." }, { status: 413 });
  }
  const body = Buffer.from(await request.arrayBuffer());
  if (!body.length) return Response.json({ error: "Send the photo as the request body." }, { status: 400 });
  const variant = new URL(request.url).searchParams.get("variant") ?? "mp3d";
  let response;
  try {
    response = await fetch(`${SERVICE}/layout?variant=${encodeURIComponent(variant)}`, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch {
    return Response.json(
      { error: "The layout model is not running. Start it with ml/.venv/bin/python ml/serve.py." },
      { status: 503 },
    );
  }
  return Response.json(await response.json(), { status: response.status });
}

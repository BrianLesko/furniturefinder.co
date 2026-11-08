import { roomTypeFromGuess } from "@/lib/room-type";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;

// A photo that is not one of the example rooms. The reply is one catalog
// room, or "other" for a bath, laundry, hallway, or anything we do not furnish.
export async function POST(request) {
  const bytes = Buffer.from(await request.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES) {
    return Response.json({ room: null }, { status: bytes.length ? 413 : 400 });
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ room: null });

  const mime = request.headers.get("content-type") || "image/jpeg";
  let room = null;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_ROOM_MODEL || "gpt-4o-mini",
        temperature: 0,
        max_tokens: 40,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "room_type",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["room"],
              properties: { room: { type: "string", enum: ["living", "kitchen", "bedroom", "other"] } },
            },
          },
        },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "What room is this photo of? living is a front room, living room, family room, or a dining area that is not a kitchen. kitchen is a kitchen. bedroom is a bedroom. other is a bath, laundry, hallway, closet, exterior, or anything else.",
              },
              { type: "image_url", image_url: { url: `data:${mime};base64,${bytes.toString("base64")}`, detail: "low" } },
            ],
          },
        ],
      }),
    });
    const body = await response.json();
    const text = body.choices?.[0]?.message?.content;
    if (text) room = roomTypeFromGuess(JSON.parse(text).room);
  } catch {
    room = null;
  }
  return Response.json({ room });
}

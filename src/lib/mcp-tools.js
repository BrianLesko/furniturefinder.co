import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getProducts } from "./products.js";
import { listScenes, readScene, SCENE_FILES, sceneDir } from "./scenes.js";

// Tools shared by the local stdio MCP server and the hosted one at /api/mcp.
// `ownerId` limits scenes to one account; null (local only) sees them all.

function text(body) {
  return { content: [{ type: "text", text: body }] };
}

async function pngPart(file) {
  const data = await readFile(file);
  const mimeType = file.endsWith(".webp") ? "image/webp" : file.endsWith(".jpg") ? "image/jpeg" : "image/png";
  return { type: "image", data: data.toString("base64"), mimeType };
}

function renderPrompt(scene) {
  const { width, height } = scene.room;
  const pieces = scene.items
    .map((item, i) => {
      const b = item.box;
      const points = (list) => list.map((p) => `(${p.x}, ${p.y})`).join(", ");
      if (item.category === "rug" && item.floorCorners) {
        return `${i + 1}. ${item.name} (rug, ${item.inches.width}" × ${item.inches.depth}"), lying flat on the floor with its corners at ${points(item.floorCorners)}, back left first. Keep it flat and in that outline.`;
      }
      const seen = item.viewAzimuthDeg != null ? `, seen by the room's camera from ${item.viewAzimuthDeg}° around (0 is its front, 90 its right side)` : "";
      const footprint = item.floorCorners
        ? ` Its footprint on the floor${item.liftIn ? " below it" : ""} is ${points(item.floorCorners)} and the top of its box is ${points(item.topCorners)}, each back left, back right, front right, front left.`
        : ` Its front meets the floor at (${item.floorPoint.x}, ${item.floorPoint.y}).`;
      return `${i + 1}. ${item.name} (${item.category}, ${item.inches.width}" W × ${item.inches.height}" H × ${item.inches.depth}" D), drawn from its ${item.angle} photo${item.altitudeDeg != null ? ` shot from ${item.altitudeDeg}° up` : ""}${item.flip ? ", mirrored" : ""}${seen}${item.cameraAltitudeDeg != null ? `, the camera looking down on it about ${item.cameraAltitudeDeg}°` : ""}, inside x ${b.x}, y ${b.y}, ${b.width} × ${b.height} px${item.liftIn ? `, raised ${item.liftIn}" off the floor` : ""}.${footprint}`;
    })
    .join("\n");
  const gaps = scene.hasMask
    ? "White areas of the mask image were invented when the photo was straightened. Fill them with a believable continuation of the walls, floor, ceiling, and trim around them."
    : "The straighten left no gaps to fill.";
  return [
    `Edit the room photo into a photoreal furnished room, ${width} × ${height} px, the same framing as the photo.`,
    "The mockup image shows each catalog piece pasted at its true size and place. Re-render every piece so it belongs in the room: match the light direction, color temperature, and grain of the photo; add contact shadows and occlusion; its edges already follow the room's perspective, so keep each piece standing on its footprint and inside its box, cleaning up any bend where the mockup's warp joins.",
    "Keep each piece's design, color, and materials exactly as in its reference photos. Do not add, remove, or restyle anything else. Walls, windows, doors, floors, and fixtures stay as photographed.",
    gaps,
    `Pieces, back to front:\n${pieces}`,
  ].join("\n\n");
}

export function registerTools(server, { ownerId = null } = {}) {
  const local = ownerId == null;
  const ownScene = async (id) => {
    const scene = await readScene(id).catch(() => null);
    return scene && (local || scene.ownerId === ownerId) ? scene : null;
  };

  server.registerTool(
    "list_products",
    {
      description: "List the Furniture Finder catalog: each piece's id, seller, category, size in inches, and photos.",
      inputSchema: {},
    },
    async () => {
      const products = getProducts();
      if (!products.length) return text("No products.");
      return text(
        products
          .map((product) => {
            const photos = product.photos
              .map((shot) => `${shot.angle} (azimuth ${shot.azimuthDeg}°, altitude ${shot.altitudeDeg}°${shot.mirrorOf ? `, mirror of ${shot.mirrorOf}` : ""}): ${shot.path}`)
              .join(", ");
            return [
              `## ${product.name}`,
              `- id: ${product.id}`,
              `- seller: ${product.sellerName}`,
              `- category: ${product.category}`,
              `- symmetry: ${product.symmetry}`,
              `- inches: ${product.widthIn} W × ${product.heightIn} H × ${product.depthIn} D`,
              `- photos: ${photos}`,
            ].join("\n");
          })
          .join("\n\n"),
      );
    },
  );

  server.registerTool(
    "place_brief",
    {
      description:
        "Return the JSON brief an external image model should use to rerender one catalog piece in a room photo. Does not call an image API and does not composite the photo.",
      inputSchema: {
        product_id: z.number().int().positive(),
        room_photo: z.string().describe("Path or URL of the straightened room photo"),
        bbox: z
          .object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() })
          .describe("Placement box in room-photo pixels"),
      },
    },
    async ({ product_id, room_photo, bbox }) => {
      const product = getProducts().find((item) => item.id === product_id);
      if (!product) return { isError: true, content: [{ type: "text", text: `No product with id ${product_id}.` }] };
      const brief = {
        room_photo,
        product_id: product.id,
        product_photos: product.photos,
        bbox,
        inches: { width: product.widthIn, height: product.heightIn, depth: product.depthIn },
      };
      return text(JSON.stringify(brief, null, 2));
    },
  );

  server.registerTool(
    "list_scenes",
    {
      description: `List the rooms saved from the Furniture Finder studio${local ? "" : " on this account"}, newest first. Each is a straightened room photo with furniture placed at true scale, waiting for its final render.`,
      inputSchema: {},
    },
    async () => {
      const list = await listScenes(local ? {} : { ownerId });
      if (!list.length) return text("No saved rooms. Save one from furniturefinder.co/dashboard.");
      return text(
        list
          .map((scene) => `- ${scene.id}: ${scene.items.length} piece(s), ${scene.room.width} × ${scene.room.height}, saved ${scene.updatedAt ?? scene.createdAt}`)
          .join("\n"),
      );
    },
  );

  server.registerTool(
    "render_scene",
    {
      description:
        "Everything the caller's image model needs for the final render of one saved room: the render prompt, the room photo, the cutout mockup, the mask of gaps left by straightening, and each piece's reference photo. Fill the gaps in this same render. This server does not call an image model.",
      inputSchema: {
        scene_id: z.string().describe("Id from list_scenes, or the one the studio showed after saving"),
        include_images: z.boolean().optional().describe("Attach the images inline. Default true."),
      },
    },
    async ({ scene_id, include_images = true }) => {
      const scene = await ownScene(scene_id);
      if (!scene) return { isError: true, content: [{ type: "text", text: `No saved room ${scene_id}.` }] };
      const dir = sceneDir(scene.id);
      const files = {
        room: path.join(dir, SCENE_FILES.room),
        mockup: path.join(dir, SCENE_FILES.mockup),
        mask: scene.hasMask ? path.join(dir, SCENE_FILES.mask) : null,
        references: [...new Set(scene.items.map((item) => item.photo))].map((photo) => path.join(process.cwd(), "public", photo)),
      };
      const details = local ? { scene_id: scene.id, files } : { scene_id: scene.id };
      const content = [text(`${renderPrompt(scene)}\n\n${JSON.stringify(details, null, 2)}`).content[0]];
      if (include_images) {
        content.push({ type: "text", text: "Room photo:" }, await pngPart(files.room));
        content.push({ type: "text", text: "Mockup with the pieces placed:" }, await pngPart(files.mockup));
        if (files.mask) content.push({ type: "text", text: "Gap mask, white is invented:" }, await pngPart(files.mask));
        for (const [i, file] of files.references.entries()) {
          content.push({ type: "text", text: `Reference photo ${i + 1}:` }, await pngPart(file));
        }
      }
      return { content };
    },
  );
}

import path from "node:path";
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const root = path.resolve(import.meta.dirname, "..");
process.chdir(root);

const point = z.object({
  x: z.number(),
  y: z.number(),
});

function text(body) {
  return { content: [{ type: "text", text: body }] };
}

async function straighten(image, quad) {
  let mod;
  try {
    mod = await import(pathToFileURL(path.join(root, "src/lib/perspective.js")).href);
  } catch (err) {
    if (err?.code === "ERR_MODULE_NOT_FOUND") return null;
    throw err;
  }
  if (typeof mod.straightenQuad !== "function") return null;
  return mod.straightenQuad(image, quad);
}

const server = new McpServer({
  name: "furniture-finder",
  version: "0.1.0",
});

server.registerTool(
  "straighten_photo",
  {
    description:
      "Accept a listing photo and the four corners of a wall. When src/lib/perspective.js exports straightenQuad, warp toward parallel verticals. Until that runs in this process, return the photo and corners unchanged with a note. Does not call an image model.",
    inputSchema: {
      image_path: z.string().optional().describe("Room photo path, absolute or relative to the repo"),
      image_base64: z.string().optional().describe("Room photo as base64, when there is no path"),
      quad: z.array(point).length(4).describe("Wall corners in image pixels, top-left then clockwise"),
    },
  },
  async ({ image_path, image_base64, quad }) => {
    const image = { path: image_path ?? null, base64: image_base64 ?? null };
    let note = "src/lib/perspective.js is not available in this process. The photo and the four corners are unchanged.";
    let changed = false;
    try {
      const warped = await straighten(image, quad);
      if (warped) {
        changed = true;
        note = "Warped with straightenQuad from src/lib/perspective.js.";
        if (warped.base64) image.base64 = warped.base64;
        if (warped.path) image.path = warped.path;
      }
    } catch (err) {
      note = `The warp did not run in this process (${err.message}). The photo and the four corners are unchanged.`;
    }
    const payload = {
      note,
      changed,
      image_path: image.path,
      image_base64: image.base64,
      quad,
    };
    return text(`${note}\n\n${JSON.stringify(payload, null, 2)}`);
  },
);

const { registerTools } = await import(pathToFileURL(path.join(root, "src/lib/mcp-tools.js")).href);
registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);

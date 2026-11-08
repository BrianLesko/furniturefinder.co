// Public docs. The index, each page, and the .md mirror all read this list.

const ORIGIN = "https://furniturefinder.co";

export const docs = [
  {
    slug: "getting-started",
    title: "Get started",
    summary: "Upload a photo, straighten it, set the scale, place a piece, and save.",
    description:
      "Use the Furniture Finder studio: choose a listing photo, straighten the walls, set the scale from a door or the ceiling, place a real piece, and save the scene for your AI to render.",
    sections: [
      {
        paragraphs: [
          "The studio is four steps: Photo, Straighten & scale, Pieces, Render. Trying a room is free. Saving it to your account, and connecting an AI to render it, is $12 a month.",
        ],
      },
      {
        h: "Open the studio",
        paragraphs: [
          "Go to the [studio](/studio). Choose a photo from your computer, or start from a room at 326 Wyandotte Ave.",
          "An empty room works best. Shoot it level, with the floor and the far wall in the frame. The full shot list, including one empty photo and one furnished, is in [The photos to include](/blog/photos-to-include).",
        ],
      },
      {
        h: "Straighten, then set the scale",
        paragraphs: [
          "Open Straighten & scale. The photo starts on Upright, which stands the verticals up. Switch to Four corners or Two lines when the walls still lean. [When to use each one](/docs/straighten).",
          "Then the yellow stick. Stand it on the floor against a door or the ceiling, and pick that height: Door is 80 inches, Ceiling is 8 feet. Counter is 36 inches, and Outlet center is 14, or type your own. Drag the dashed line to the camera's eye level.",
          "The panel shows how high the camera is, in inches. If it says to check the stick, the stick is on the wrong thing or the dashed line is in the wrong place. A piece's size is only true once the verticals stand upright.",
        ],
      },
      {
        h: "Place a piece",
        paragraphs: [
          "Open Pieces. Press Add a piece, the + in the corner of the photo. Drag a piece by where it meets the floor. It gets smaller as it moves back into the room.",
          "Near a wall, it turns to sit flat against it. Hold Alt while you drag to place it freely. Drag a piece onto the trash to remove it. Every piece in the catalog has a seller and a real width, height, and depth. [Browse them](/pick).",
        ],
      },
      {
        h: "Save, then render",
        paragraphs: [
          "Press Save the room, next to the steps. Sign in if it asks, then save again. The room stays as you left it. A subscription keeps the saved room on your [dashboard](/dashboard).",
          "After it saves, the studio shows a scene id. Ask your AI: Render Furniture Finder scene, and that id. The model you already use does the render. Furniture Finder does not spend image credits on it. [Connect an agent](/docs/connect-an-agent) first, or the ask has nowhere to go.",
        ],
      },
    ],
  },
  {
    slug: "straighten",
    title: "Straighten a photo",
    summary: "Four corners when a wall faces you. Two lines when you shot into a corner.",
    description:
      "When to straighten a listing photo with four corners, two vertical lines, or Upright, and how to set the scale from a door or the ceiling so pieces sit at their real size.",
    sections: [
      {
        paragraphs: [
          "Wide listing photos lean. Door frames tip in, and a piece set on that floor comes out the wrong size. Straighten the photo before you place anything.",
          "In the [studio](/studio) this is the Straighten & scale step. You pick a mode and the correction is applied. A mode stays grey when it does not fit that photo. On the [straighten page](/straighten) you place the handles yourself, which is the one to use when you want to nudge a corner.",
        ],
      },
      {
        h: "Upright",
        paragraphs: [
          "Start here. Upright reads the camera's tilt and stands the verticals up. If there is nothing to stand up, the photo stays as it was taken.",
        ],
      },
      {
        h: "Four corners",
        paragraphs: [
          "Use Four corners when one wall faces the camera. A fireplace wall. The far wall of a bedroom shot from the door. A kitchen shot square from the entry.",
          "On the straighten page, drag the four corners of that wall until they make a rectangle. The whole photo squares to that wall. The fireplace and the window stay where they are. In the studio, choose Four corners and the same correction is applied from the wall it found.",
        ],
      },
      {
        h: "Two lines",
        paragraphs: [
          "Use Two lines when you stood in a corner and two walls meet in the frame. No single wall is square to the camera, so four corners of one wall have nothing flat to hold.",
          "On the straighten page, drag one line onto a door frame or a wall edge on the left, and the other onto an upright on the right. Those two lines are made vertical, and the rest of the photo follows. In the studio, choose Two lines.",
        ],
      },
      {
        h: "As shot",
        paragraphs: [
          "Use As shot when the verticals are already straight, or you want the original framing. A correction crops the edges, and a straight photo does not need that crop.",
          "If the walls still lean, leave the mode on Upright, Four corners, or Two lines. A piece's size is only true on upright walls.",
        ],
      },
      {
        h: "What the correction changes",
        paragraphs: [
          "A hard straighten crops the edges and can leave wedges the photo never contained. The render fills those wedges in the same pass as the furniture.",
          "Keep the fireplace and the brick off the edge of the frame, about a third of the way in, so the crop does not take them. Where to stand for that shot is in [The photos to include](/blog/photos-to-include).",
        ],
      },
      {
        h: "Then set the scale",
        paragraphs: [
          "On the same studio step, stand the yellow stick on the floor against a door or the ceiling. Door is 80 inches. Ceiling is 8 feet. Drag the dashed line to eye level.",
          "Changing the straighten mode puts the stick and the dashed line back to their automatic places. Pick the mode first, then set the stick. The rest of the path, from the photo to a saved scene, is in [Get started](/docs/getting-started).",
        ],
      },
    ],
  },
  {
    slug: "connect-an-agent",
    title: "Connect an agent",
    summary: "The MCP URL, a key from your dashboard, and what the agent can do.",
    description:
      "Connect Claude Code, Cursor, or Codex to the Furniture Finder MCP server with a dashboard key, then ask it to render a saved room.",
    sections: [
      {
        paragraphs: [
          "Furniture Finder does not render the photo. Your AI does. It reads the room you saved through the MCP server, using a key from your dashboard. The account has to be subscribed. The studio stays free to try without this.",
          "The server is [https://furniturefinder.co/api/mcp](https://furniturefinder.co/api/mcp). It speaks Streamable HTTP. Send the key as a bearer token.",
        ],
      },
      {
        h: "Make a key",
        paragraphs: [
          "Sign in and open the [dashboard](/dashboard). Name the key for the app that will use it, such as Laptop Claude, and press New key. Copy it then. It is shown once, and it starts with ff_.",
          "Revoke a key when you stop using that app. A revoked key stops connecting.",
        ],
      },
      {
        h: "Add the server",
        paragraphs: [
          "The header is Authorization: Bearer, then your key. The dashboard fills these snippets in and has a copy button. Until you have a key, they show ff_YOUR_KEY.",
        ],
        codes: [
          {
            label: "Claude Code. Run in a terminal:",
            text: 'claude mcp add --transport http furniture-finder https://furniturefinder.co/api/mcp --header "Authorization: Bearer ff_YOUR_KEY"',
          },
          {
            label: "Cursor. Add to ~/.cursor/mcp.json:",
            text: `{
  "mcpServers": {
    "furniture-finder": {
      "url": "https://furniturefinder.co/api/mcp",
      "headers": { "Authorization": "Bearer ff_YOUR_KEY" }
    }
  }
}`,
          },
          {
            label: "Codex. Add to ~/.codex/config.toml:",
            text: `[mcp_servers.furniture-finder]
url = "https://furniturefinder.co/api/mcp"
http_headers = { Authorization = "Bearer ff_YOUR_KEY" }`,
          },
        ],
      },
      {
        h: "What the agent can do",
        list: [
          ["list_scenes.", "The rooms saved on this account, newest first."],
          ["render_scene.", "The prompt, the straightened room, the mockup with the pieces at true size, the gap mask, and each piece's reference photo. Your model renders from that. This server does not call an image model."],
          ["list_products.", "The catalog: seller, category, size in inches, and photos."],
          ["place_brief.", "A JSON brief for one piece in a room photo. It does not composite the photo."],
        ],
      },
      {
        h: "Ask for the render",
        paragraphs: [
          "Press Save the room in the [studio](/studio) first. Then ask: Render Furniture Finder scene, and the id the studio showed. Or: Render my latest Furniture Finder room.",
          "The model matches the light and keeps each piece's design, color, and materials. Walls, windows, doors, and floors stay as photographed. White on the gap mask is filled in that same render.",
          "If the connection is refused, the key is missing, revoked, or the account is not subscribed. Making the room those tools render is in [Get started](/docs/getting-started).",
        ],
      },
    ],
  },
];

export function docBySlug(slug) {
  return docs.find((doc) => doc.slug === slug) ?? null;
}

export function docUrl(doc) {
  return `${ORIGIN}/docs/${doc.slug}`;
}

export function docMarkdown(doc) {
  const lines = [`# ${doc.title}`, "", doc.description, "", `Canonical: ${docUrl(doc)}`, ""];
  for (const section of doc.sections) {
    if (section.h) lines.push(`## ${section.h}`, "");
    for (const paragraph of section.paragraphs ?? []) lines.push(paragraph, "");
    if (section.list) {
      for (const [lead, rest] of section.list) lines.push(`- **${lead}** ${rest}`);
      lines.push("");
    }
    for (const code of section.codes ?? []) lines.push(code.label, "", "```", code.text, "```", "");
  }
  return `${lines.join("\n").trim()}\n`;
}

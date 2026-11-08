export const ABOUT_URL = "https://furniturefinder.co/about";
export const aboutTitle = "Why I built Furniture Finder";
export const aboutDescription =
  "Hi, I'm Brian. I rent houses in Columbus. Listing photos are the first impression, and taking good ones took planning and practice, so I built Furniture Finder.";

export function aboutMarkdown() {
  return [
    `# ${aboutTitle}`,
    "",
    "Hi, I'm [Brian](https://brianlesko.com). I rent houses in Columbus, near Ohio State.",
    "",
    "I learned that listing photos are your first impression. But taking good ones took a lot of planning and practice.",
    "",
    "So, I built Furniture Finder with 3 things in mind:",
    "",
    "- **Fix the photo you already have.** Straighten the walls a wide lens leans in. Keep the window light.",
    "- **Real furniture, at real size.** Every piece is one you can buy, set on the floor at its width, height, and depth.",
    "- **AI agent first.** Claude, ChatGPT, or Codex renders the room through the [MCP server](https://furniturefinder.co/docs/connect-an-agent).",
    "",
    "Oh, and no wordmark on your photos. On all plans.",
    "",
    `Canonical: ${ABOUT_URL}`,
    "",
  ].join("\n");
}

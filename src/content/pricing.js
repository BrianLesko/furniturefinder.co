// Pricing page copy. The page and the markdown mirror both read this.

export const PRICING_PATH = "/pricing";
export const PRICING_URL = "https://furniturefinder.co/pricing";

export const pricingTitle = "How much virtual staging costs";
export const pricingDescription =
  "Furniture Finder is $12 a month for every room. Trying a room in the studio is free. Saving it, and connecting your AI to render it, is the subscription. The render runs on your model.";

export const freeItems = [
  ["Try a room", "Straighten a listing photo and set a catalog piece on the floor, in the browser."],
  ["Use a photo you have", "Start from a room on the site, or choose a photo from your computer."],
  ["See it at real size", "The piece sits on the floor at its real width, height, and depth. The window and the floor line stay."],
];

export const paidItems = [
  ["Save the room", "It stays on your account, with the straightened photo, the mockup, and the mask."],
  ["Connect your AI", "Claude, ChatGPT, Codex, or Cursor renders the saved room through the MCP server."],
  ["Custom pieces", "Add a piece from a listing that is not in the catalog yet."],
  ["Your dashboard", "Saved rooms, API keys, and billing."],
];

export const notIncluded = [
  ["The render", "Your model does it. Furniture Finder does not bill image credits for that step."],
  ["The furniture", "Every piece is a real listing you can buy. It does not come with the house."],
  ["A crew or a reshoot", "The photo you already have is the one that gets furnished."],
];

export const comparisons = [
  ["Virtual staging services", "/blog/furniture-finder-vs-virtual-staging", "Billed again for every photo."],
  ["AI staging apps", "/blog/furniture-finder-vs-ai-staging-apps", "A sofa the model invented, and a credit for every render."],
  ["A staging crew", "/blog/furniture-finder-vs-home-staging", "Furniture in the house, movers, and a second shoot."],
  ["Photoshop", "/blog/furniture-finder-vs-photoshop", "Cutouts you place by eye."],
];

export const pricingFaq = [
  {
    q: "How much does virtual staging cost?",
    a: "Furniture Finder is $12 a month, for every room you do. Trying a room in the studio is free. Saving the room and connecting your AI is the subscription.",
  },
  {
    q: "Do I pay again for every photo?",
    a: "No. The $12 covers the month, whether you furnish one room or thirty. A virtual staging service bills again for every photo.",
  },
  {
    q: "Does the $12 include the AI render?",
    a: "No. The render runs on the model you already use, such as Claude, ChatGPT, Codex, or Cursor. The $12 is for the studio tools, saved rooms, and the connection.",
  },
  {
    q: "Can I stage my own listing photo?",
    a: "Yes. In the studio, choose a photo from your computer, or start from a room already on the site. Saving that room to your account is part of the subscription.",
  },
  {
    q: "Can I cancel?",
    a: "Yes. Manage or cancel the subscription from your dashboard. Checkout is Stripe, and it accepts a promo code.",
  },
  {
    q: "Do I have to label a virtually staged photo?",
    a: "Say so where the listing site asks, and keep the empty photo next to the furnished one. The furniture in the picture is not included with the house.",
  },
];

export function pricingMarkdown() {
  const lines = [
    `# ${pricingTitle}`,
    "",
    pricingDescription,
    "",
    `Canonical: ${PRICING_URL}`,
    "",
    "Trying a room is free. Furniture Finder is $12 a month after that, billed once a month.",
    "",
    "## Free to try",
    "",
  ];
  for (const [name, detail] of freeItems) lines.push(`- **${name}.** ${detail}`);
  lines.push("", "## $12 a month", "");
  for (const [name, detail] of paidItems) lines.push(`- **${name}.** ${detail}`);
  lines.push("", "## What the $12 does not include", "");
  for (const [name, detail] of notIncluded) lines.push(`- **${name}.** ${detail}`);
  lines.push("", "## Compared with paying another way", "");
  for (const [name, href, detail] of comparisons) lines.push(`- [${name}](https://furniturefinder.co${href}). ${detail}`);
  lines.push("", "## Questions", "");
  for (const item of pricingFaq) lines.push(`### ${item.q}`, "", item.a, "");
  lines.push("Try a room in the [studio](https://furniturefinder.co/studio). Subscribe from [this page](https://furniturefinder.co/pricing).");
  lines.push("");
  return lines.join("\n");
}

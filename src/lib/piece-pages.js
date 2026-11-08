import path from "node:path";
import sharp from "sharp";
import { getProducts } from "./products.js";

// Which catalog pieces get a public page at /pieces/<slug>. Amazon pieces wait
// for the Associates approval, since their links have to carry the tag.
const HELD_SELLERS = new Set(["Amazon"]);
// Working copies of another piece, kept for the studio.
const HIDDEN_SLUGS = new Set(["kivik-sofa-tallmyra-dark"]);

export function listedPieces() {
  return getProducts().filter((product) => product.productUrl && !HELD_SELLERS.has(product.sellerName) && !HIDDEN_SLUGS.has(product.slug));
}

export function pieceBySlug(slug) {
  return listedPieces().find((product) => product.slug === slug) ?? null;
}

// Affiliate tags go here once a network approves the site, keyed by seller.
const AFFILIATE = {};

export function buyLink(product) {
  const tag = AFFILIATE[product.sellerName];
  return tag ? { href: tag(product.productUrl), rel: "sponsored noopener" } : { href: product.productUrl, rel: "noopener" };
}

export function kindOf(product) {
  if (product.category === "table") return product.heightIn < 22 ? "coffee table" : "dining table";
  if (product.category === "rug") return product.widthIn < 40 ? "runner" : "rug";
  if (product.category === "tv") return "TV";
  if (product.category === "console") return "media console";
  if (product.category === "stool") return product.heightIn < 28 ? "counter stool" : "bar stool";
  return product.category;
}

export const KIND_PLURAL = {
  sofa: "Sofas",
  chair: "Chairs",
  "counter stool": "Counter stools",
  "bar stool": "Bar stools",
  bench: "Benches",
  "coffee table": "Coffee tables",
  "dining table": "Dining tables",
  "media console": "Media consoles",
  TV: "TVs",
  rug: "Rugs",
  runner: "Runners",
};

const FRACTIONS = [
  [0, ""],
  [0.125, "⅛"],
  [0.25, "¼"],
  [0.375, "⅜"],
  [0.5, "½"],
  [0.625, "⅝"],
  [0.75, "¾"],
  [0.875, "⅞"],
];

export function inches(value) {
  const whole = Math.floor(value + 1e-6);
  const match = FRACTIONS.find(([amount]) => Math.abs(value - whole - amount) < 0.01);
  if (!match) return `${Math.round(value * 10) / 10}″`;
  return `${whole || ""}${match[1]}″`;
}

export function feet(value) {
  const total = Math.round(value);
  const ft = Math.floor(total / 12);
  const rest = total % 12;
  return rest ? `${ft}′${rest}″` : `${ft}′`;
}

export const cm = (value) => `${Math.round(value * 2.54)} cm`;

export function money(cents) {
  const whole = cents % 100 === 0;
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: whole ? 0 : 2 });
}

export function quotedDate(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function sizeLine(product) {
  return `${inches(product.widthIn)} W × ${inches(product.depthIn)} D × ${inches(product.heightIn)} H`;
}

// One photo per angle, lowest camera first, for the page's views.
export function viewPhotos(product) {
  const seen = new Set();
  return product.photos.filter((photo) => {
    if (seen.has(photo.angle)) return false;
    seen.add(photo.angle);
    return true;
  });
}

// Product photos share one canvas per piece, so most of each one is empty.
// The visible box, as fractions of the image, lets a page crop to the piece.
const boxes = new Map();

export async function visibleBox(photo) {
  if (!boxes.has(photo.path)) {
    const file = path.join(/* turbopackIgnore: true */ process.cwd(), "public", photo.path);
    boxes.set(
      photo.path,
      Promise.all([sharp(file).metadata(), sharp(file).trim({ threshold: 0 }).toBuffer({ resolveWithObject: true })])
        .then(([meta, { info }]) => {
          const pad = 0.04 * Math.max(info.width, info.height);
          const x = Math.max(0, -info.trimOffsetLeft - pad);
          const y = Math.max(0, -info.trimOffsetTop - pad);
          const w = Math.min(meta.width - x, info.width + 2 * pad);
          const h = Math.min(meta.height - y, info.height + 2 * pad);
          return { x: x / meta.width, y: y / meta.height, w: w / meta.width, h: h / meta.height, aspect: w / h };
        })
        .catch(() => ({ x: 0, y: 0, w: 1, h: 1, aspect: 4 / 3 })),
    );
  }
  return boxes.get(photo.path);
}

export const viewLabel = (angle) => angle.charAt(0).toUpperCase() + angle.slice(1).replace(/-/g, " ");

// Rules of thumb for the space around each kind of piece. The numbers are the
// usual designer and NKBA clearances, worked out for this piece's size.
export function fitNotes(product) {
  const { widthIn: w, depthIn: d, heightIn: h } = product;
  switch (kindOf(product)) {
    case "sofa":
      return [
        ["Wall length:", `${inches(w)} of wall, ${feet(w + 12)} if you want 6″ of air on each side.`],
        ["In front:", `${inches(d)} deep, then 14″ to 18″ to the coffee table and 30″ to 36″ of walkway past it.`],
        ["Rug:", `wide enough that the front legs sit on it, so at least ${feet(w + 12)} across.`],
      ];
    case "coffee table":
      return [
        ["Sofa:", `a coffee table looks right at about two thirds of the sofa's length. ${inches(w)} suits a sofa around ${feet(w * 1.5)} long.`],
        ["Gap:", "14″ to 18″ from the sofa, close enough to reach a drink."],
        ["Height:", `at ${inches(h)}, it sits a few inches under a typical 17″ to 19″ sofa seat.`],
      ];
    case "dining table":
      return [
        ["Chairs:", "leave 36″ from the table edge to the wall so a chair can pull out, and 42″ to 48″ if people walk behind."],
        ["Room size:", `that makes the smallest comfortable room about ${feet(w + 72)} × ${feet(d + 72)}.`],
        ["Rug:", `a rug under it should run 24″ past the edge all around, about ${feet(w + 48)} × ${feet(d + 48)}.`],
      ];
    case "chair":
      return [
        ["At the table:", `give each chair about ${inches(w + 4)} of table edge, its ${inches(w)} width plus elbow room.`],
        ["Behind it:", "36″ from the table edge to the wall lets you pull it out and sit down."],
      ];
    case "counter stool":
    case "bar stool":
      return [
        ["Counter:", `a ${inches(h)} seat fits a ${h < 28 ? "36″ kitchen counter" : "42″ bar"}, with 10″ to 12″ for your knees.`],
        ["Spacing:", `${inches(w)} wide plus 6″ between stools. A 6′ island seats ${Math.floor(72 / (w + 6))}.`],
      ];
    case "bench":
      return [
        ["Seats:", `about ${Math.max(1, Math.floor(w / 21))} at ${inches(w)} wide, at roughly 21″ a person.`],
        ["Table:", `pull the table to within a few inches of the seat front. The bench takes ${inches(d)} from the wall.`],
      ];
    case "media console":
      return [
        ["TV:", `a console should be wider than the TV on it. ${inches(w)} suits a TV up to about ${inches(w - 8)} wide, which is roughly a ${Math.floor((w - 8) / 0.87)}″ screen.`],
        ["Wall:", `${inches(w)} of wall, and ${inches(d)} out from it.`],
      ];
    case "TV": {
      const diagonal = Number(product.name.match(/(\d+)"/)?.[1]) || Math.round(Math.hypot(w, h));
      return [
        ["Seating distance:", `for a ${diagonal}″ 4K TV, sit about ${feet(diagonal)} to ${feet(diagonal * 1.5)} away.`],
        ["Wall:", `${inches(w)} of wall, centered about 42″ off the floor.`],
        ["Console:", `stand it on a console at least ${feet(w + 6)} wide.`],
      ];
    }
    case "rug": {
      const notes = [["Living room:", `at ${feet(w)} × ${feet(d)}, the front legs of a sofa up to ${feet(d - 12)} long sit on it, with 6″ to spare at each end.`]];
      if (w - 48 >= 30) notes.push(["Dining room:", `it holds a table up to about ${feet(w - 48)} × ${feet(d - 48)}, with the chairs still on it when pulled out.`]);
      else notes.push(["Dining room:", `too small to go under a dining table with chairs, which needs about 24″ of rug past the table edge all around.`]);
      return notes;
    }
    case "runner":
      return [
        ["Hallway:", `leave 4″ to 6″ of floor showing on each side. ${inches(w)} wide suits a hall about ${feet(w + 8)} to ${feet(w + 12)} wide.`],
        ["Length:", `${feet(d)} long, so stop it a few inches short of doors at either end.`],
      ];
    default:
      return [];
  }
}

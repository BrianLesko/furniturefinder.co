// Bootstraps the first 17 pieces. After that the database is the catalog:
// the team adds pieces through the add page, so this refuses to run over a
// database that already has products unless you pass --reset.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
process.chdir(root);
const { DB_PATH: dbPath, SYMMETRY, openDb } = await import("../src/lib/db.js");
const { VIEWS, mirrorsOf } = await import("../src/lib/views.js");
const photoDir = path.join(root, "public", "products");
const reset = process.argv.includes("--reset");

const sellers = [
  { name: "IKEA", url: "https://www.ikea.com/us/en/" },
  { name: "West Elm", url: "https://www.westelm.com/" },
  { name: "Pottery Barn", url: "https://www.potterybarn.com/" },
  { name: "Amazon", url: "https://www.amazon.com/" },
  { name: "Crate & Barrel", url: "https://www.crateandbarrel.com/" },
  { name: "Best Buy", url: "https://www.bestbuy.com/" },
  { name: "Rugs USA", url: "https://www.rugsusa.com/" },
];

// Azimuth and altitude are defined in src/lib/views.js.
// [angle, altitude] pairs, with an optional azimuth that overrides VIEWS.
function views(...list) {
  return list.map(([angle, altitude, azimuth]) => ({ angle, altitude, azimuth }));
}

function quarterSet(altitude, azimuth = 45) {
  return views(["front", altitude], ["one-quarter", altitude, -azimuth], ["three-quarter", altitude, azimuth]);
}

// A second set of views from higher up, saved as {slug}-{angle}-{altitude}.png.
function highSet(altitude, ...angles) {
  return angles.map((angle) => ({ angle, altitude, tier: String(altitude) }));
}

const fileOf = (piece, photo) => `${piece.slug}-${photo.angle}${photo.tier ? `-${photo.tier}` : ""}.png`;
const sameTier = (a, b) => (a.tier ?? null) === (b.tier ?? null);

const catalog = [
  {
    seller: "IKEA",
    name: "KIVIK sofa, Tallmyra dark green",
    category: "sofa",
    room: "living",
    width_in: 89.75,
    height_in: 32.625,
    depth_in: 37.375,
    symmetry: "mirror",
    photos: [
      ...quarterSet(10),
      ...views(["side", 5], ["front-side", 10, 63], ["back-three-quarter", 10], ["back", 10]),
      ...highSet(25, "front", "three-quarter", "side", "back-three-quarter", "back"),
      { angle: "front-side", altitude: 25, azimuth: 66, tier: "25" },
    ],
    slug: "kivik-sofa",
    price_cents: 94900,
    quoted_on: "2026-11-07",
  },
  {
    seller: "IKEA",
    name: "LOHALS jute rug",
    category: "rug",
    room: "living",
    width_in: 79,
    height_in: 0.5,
    depth_in: 118,
    symmetry: "rectangle",
    photos: [...quarterSet(30, 34), ...views(["side", 30], ["top", 90])],
    slug: "lohals-rug",
    price_cents: 13999,
    compare_at_cents: 17999,
    quoted_on: "2026-11-07",
  },
  {
    seller: "West Elm",
    name: "Vaila solid oak coffee table",
    category: "table",
    room: "living",
    width_in: 43.3,
    height_in: 15.7,
    depth_in: 43.3,
    symmetry: "square",
    photos: [...quarterSet(10), ...views(["top", 90])],
    slug: "vaila-table",
    price_cents: 134900,
    quoted_on: "2026-11-07",
  },
  {
    seller: "Pottery Barn",
    name: "Maison leather counter stool",
    category: "stool",
    room: "kitchen",
    width_in: 16,
    height_in: 24,
    depth_in: 16,
    symmetry: "square",
    photos: [...quarterSet(20), ...views(["three-quarter-high", 35, 45])],
    slug: "maison-stool",
    price_cents: 33900,
    price_max_cents: 45900,
    quoted_on: "2026-11-07",
  },
  {
    seller: "IKEA",
    name: "STOCKHOLM 2025 oak dining table",
    category: "table",
    room: "kitchen",
    width_in: 45.25,
    height_in: 29.5,
    depth_in: 45.25,
    symmetry: "square",
    photos: quarterSet(10),
    slug: "stockholm-table",
    price_cents: 71999,
    compare_at_cents: 89999,
    quoted_on: "2026-11-07",
  },
  {
    seller: "IKEA",
    name: "BERGMUND chair, light gray",
    category: "chair",
    room: "kitchen",
    width_in: 20.5,
    height_in: 37.375,
    depth_in: 23.25,
    symmetry: "mirror",
    photos: [...quarterSet(15), ...views(["side", 15], ["back-three-quarter", 15], ["back", 15])],
    slug: "bergmund-chair",
    price_cents: 12500,
    quoted_on: "2026-11-07",
  },
  {
    seller: "IKEA",
    name: "LOHALS jute runner",
    category: "rug",
    room: "kitchen",
    width_in: 31,
    height_in: 0.5,
    depth_in: 118,
    symmetry: "rectangle",
    photos: [...quarterSet(30, 34), ...views(["side", 30])],
    slug: "lohals-runner",
    price_cents: 7999,
    quoted_on: "2026-11-07",
  },
  {
    seller: "West Elm",
    name: "Booker futon, juniper",
    category: "sofa",
    room: "living",
    width_in: 92,
    height_in: 29.5,
    depth_in: 41,
    symmetry: "mirror",
    photos: [...quarterSet(10), ...views(["side", 10], ["back-three-quarter", 10], ["back", 10])],
    slug: "booker-futon",
    price_cents: 119900,
    price_max_cents: 159900,
    quoted_on: "2026-11-07",
  },
  {
    seller: "IKEA",
    name: "MORABO sofa, black leather",
    category: "sofa",
    room: "living",
    width_in: 81.125,
    height_in: 31.875,
    depth_in: 36.25,
    symmetry: "mirror",
    photos: [...quarterSet(15), ...views(["side", 15], ["back-three-quarter", 15], ["back", 15])],
    slug: "morabo-sofa",
    price_cents: 94900,
    compare_at_cents: 134900,
    quoted_on: "2026-11-07",
  },
  {
    seller: "West Elm",
    name: "Mid-century media console",
    category: "console",
    room: "living",
    width_in: 58,
    height_in: 30,
    depth_in: 19,
    symmetry: "mirror",
    photos: [...quarterSet(10), ...views(["side", 10])],
    slug: "media-console",
    price_cents: 99900,
    quoted_on: "2026-11-07",
  },
  {
    seller: "Best Buy",
    name: "Samsung 55\" TV, wall",
    category: "tv",
    room: "living",
    width_in: 48.21,
    height_in: 27.87,
    depth_in: 3.02,
    symmetry: "mirror",
    photos: [...quarterSet(5), ...views(["side", 0])],
    slug: "samsung-tv-wall",
    price_cents: 29999,
    quoted_on: "2026-11-07",
  },
  {
    seller: "Best Buy",
    name: "Samsung 55\" TV, with feet",
    category: "tv",
    room: "living",
    width_in: 48.21,
    height_in: 29.92,
    depth_in: 7.83,
    symmetry: "mirror",
    photos: [...quarterSet(5), ...views(["side", 5])],
    slug: "samsung-tv-feet",
    price_cents: 29999,
    quoted_on: "2026-11-07",
  },
  {
    seller: "Amazon",
    name: "RIHHA nightstand",
    category: "nightstand",
    room: "bedroom",
    width_in: 20,
    height_in: 26,
    depth_in: 15.7,
    symmetry: "mirror",
    photos: [...quarterSet(15), ...views(["side", 15])],
    slug: "rihha-nightstand",
    price_cents: 11999,
    quoted_on: "2026-11-07",
  },
  {
    seller: "Amazon",
    name: "Merax queen bed frame",
    category: "bed",
    room: "bedroom",
    width_in: 64,
    height_in: 42.5,
    depth_in: 84,
    symmetry: "mirror",
    photos: [...quarterSet(25), ...views(["side", 25])],
    slug: "merax-bed",
    price_cents: 31349,
    compare_at_cents: 33999,
    quoted_on: "2026-11-07",
  },
  {
    seller: "Crate & Barrel",
    name: "Leandro banquette, hazel",
    category: "bench",
    room: "kitchen",
    width_in: 42,
    height_in: 31.5,
    depth_in: 31,
    symmetry: "mirror",
    photos: [...quarterSet(15), ...views(["side", 15], ["back-three-quarter", 15], ["back", 15])],
    slug: "leandro-banquette",
    price_cents: 89900,
    quoted_on: "2026-11-07",
  },
  {
    seller: "Amazon",
    name: "Lippa oval dining table",
    category: "table",
    room: "kitchen",
    width_in: 47,
    height_in: 29.5,
    depth_in: 27.5,
    symmetry: "rectangle",
    photos: views(["front", 25], ["one-quarter", 20, -45], ["three-quarter", 20, 45], ["side", 25]),
    slug: "lippa-table",
    price_cents: 53699,
    quoted_on: "2026-11-07",
  },
  {
    seller: "Rugs USA",
    name: "Mira geometric rug, tan",
    category: "rug",
    room: "living",
    width_in: 60,
    height_in: 0.3,
    depth_in: 96,
    symmetry: "rectangle",
    photos: [...quarterSet(30, 34), ...views(["side", 30])],
    slug: "mira-rug",
    price_cents: 21900,
    compare_at_cents: 34800,
    quoted_on: "2026-11-07",
  },
];

for (const piece of catalog) {
  if (!SYMMETRY.includes(piece.symmetry)) {
    throw new Error(`${piece.slug} has unknown symmetry ${piece.symmetry}`);
  }
  if (piece.symmetry !== "none") {
    for (const photo of [...piece.photos]) {
      for (const angle of mirrorsOf(photo.angle)) {
        if (piece.photos.some((other) => other.angle === angle && sameTier(other, photo))) continue;
        piece.photos.push({
          angle,
          altitude: photo.altitude,
          azimuth: -(photo.azimuth ?? VIEWS[photo.angle].azimuth),
          tier: photo.tier,
        });
      }
    }
  }
  for (const photo of piece.photos) {
    photo.azimuth ??= VIEWS[photo.angle]?.azimuth;
    photo.mirrorOf = VIEWS[photo.angle]?.mirrorOf ?? null;
    if (photo.azimuth == null || photo.altitude == null) {
      throw new Error(`${piece.slug} ${photo.angle} needs an azimuth and an altitude`);
    }
    if (photo.mirrorOf && !piece.photos.some((other) => other.angle === photo.mirrorOf && sameTier(other, photo))) {
      throw new Error(`${piece.slug} ${photo.angle} mirrors ${photo.mirrorOf}, which it does not have`);
    }
    const file = path.join(photoDir, fileOf(piece, photo));
    if (!fs.existsSync(file)) {
      throw new Error(`Missing product photo ${file}`);
    }
  }
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
if (fs.existsSync(dbPath)) {
  const existing = openDb();
  const { n } = existing.prepare("SELECT count(*) AS n FROM products").get();
  existing.close();
  if (n > 0 && !reset) {
    console.error(`${dbPath} already has ${n} products. Pass --reset to wipe it, including pieces the team added.`);
    process.exit(1);
  }
  fs.unlinkSync(dbPath);
}

const db = openDb();

// Where each bootstrap photo came from, as far as the old notes say.
function photoSource(piece, photo) {
  if (photo.mirrorOf) return "mirror";
  if (piece.category === "rug") return photo.angle === "top" ? "retailer" : "warped";
  if (photo.tier) return "generated";
  if (["side", "back-three-quarter", "back", "three-quarter-high"].includes(photo.angle)) return "generated";
  return "unknown";
}

const insertSeller = db.prepare("INSERT INTO sellers (name, url) VALUES (?, ?)");
const insertProduct = db.prepare(
  `INSERT INTO products (
     seller_id, slug, name, category, room, width_in, height_in, depth_in,
     price_cents, price_max_cents, compare_at_cents, quoted_on, symmetry
   )
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertPhoto = db.prepare(
  `INSERT INTO product_photos (product_id, angle, azimuth_deg, altitude_deg, mirror_of, source, path)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);

const sellerIds = new Map();
for (const seller of sellers) {
  const row = insertSeller.run(seller.name, seller.url);
  sellerIds.set(seller.name, Number(row.lastInsertRowid));
}

for (const piece of catalog) {
  const row = insertProduct.run(
    sellerIds.get(piece.seller),
    piece.slug,
    piece.name,
    piece.category,
    piece.room,
    piece.width_in,
    piece.height_in,
    piece.depth_in,
    piece.price_cents,
    piece.price_max_cents ?? null,
    piece.compare_at_cents ?? null,
    piece.quoted_on,
    piece.symmetry,
  );
  const productId = Number(row.lastInsertRowid);
  const photoIds = new Map();
  const ordered = [...piece.photos].sort((a, b) => Boolean(a.mirrorOf) - Boolean(b.mirrorOf));
  for (const photo of ordered) {
    const shot = insertPhoto.run(
      productId,
      photo.angle,
      photo.azimuth,
      photo.altitude,
      photo.mirrorOf ? photoIds.get(`${photo.mirrorOf}@${photo.tier ?? ""}`) : null,
      photoSource(piece, photo),
      `public/products/${fileOf(piece, photo)}`,
    );
    photoIds.set(`${photo.angle}@${photo.tier ?? ""}`, Number(shot.lastInsertRowid));
  }
}

db.close();
console.log(`Seeded ${catalog.length} products from ${sellers.length} sellers into ${dbPath}`);

import { openDb } from "./db.js";

const ANGLE_ORDER = {
  front: 0,
  "one-quarter": 1,
  "three-quarter": 2,
  "front-side": 3,
  "other-front-side": 4,
  side: 5,
  "other-side": 6,
  "back-side": 7,
  "other-back-side": 8,
  "back-three-quarter": 9,
  "back-one-quarter": 10,
  back: 11,
};

function photoSrc(stored) {
  const cleaned = String(stored).replace(/^public\//, "").replace(/^\//, "");
  return `/${cleaned}`;
}

export function getProducts() {
  const db = openDb({ readOnly: true });
  try {
    const products = db
      .prepare(
        `SELECT
           p.id,
           p.slug,
           p.name,
           p.category,
           p.room,
           p.width_in,
           p.height_in,
           p.depth_in,
           p.price_cents,
           p.price_max_cents,
           p.compare_at_cents,
           p.quoted_on,
           p.symmetry,
           p.source_url,
           s.name AS seller_name,
           s.url AS seller_url
         FROM products p
         JOIN sellers s ON s.id = p.seller_id
         ORDER BY p.id`,
      )
      .all();

    const photos = db
      .prepare(
        `SELECT ph.id, ph.product_id, ph.angle, ph.azimuth_deg, ph.altitude_deg, ph.source, ph.path, src.angle AS mirror_of
         FROM product_photos ph
         LEFT JOIN product_photos src ON src.id = ph.mirror_of`,
      )
      .all();

    return products.map((product) => {
      const widthIn = Number(product.width_in);
      const heightIn = Number(product.height_in);
      const depthIn = Number(product.depth_in);
      if (!(widthIn > 0) || !(heightIn > 0) || !(depthIn > 0)) {
        throw new Error(`${product.name} is missing width, height, or depth`);
      }
      const priceCents = Number(product.price_cents);
      const priceMaxCents = product.price_max_cents == null ? null : Number(product.price_max_cents);
      const compareAtCents = product.compare_at_cents == null ? null : Number(product.compare_at_cents);
      if (!(priceCents > 0) || !product.quoted_on) {
        throw new Error(`${product.name} is missing a quoted price`);
      }

      const shots = photos
        .filter((photo) => photo.product_id === product.id)
        .sort(
          (a, b) =>
            (ANGLE_ORDER[a.angle] ?? 99) - (ANGLE_ORDER[b.angle] ?? 99) ||
            a.altitude_deg - b.altitude_deg ||
            a.azimuth_deg - b.azimuth_deg,
        )
        .map((photo) => ({
          angle: photo.angle,
          azimuthDeg: Number(photo.azimuth_deg),
          altitudeDeg: Number(photo.altitude_deg),
          mirrorOf: photo.mirror_of ?? null,
          source: photo.source,
          path: photoSrc(photo.path),
        }));

      return {
        id: Number(product.id),
        slug: product.slug,
        name: product.name,
        category: product.category,
        room: product.room,
        widthIn,
        heightIn,
        depthIn,
        priceCents,
        priceMaxCents,
        compareAtCents,
        quotedOn: product.quoted_on,
        sellerName: product.seller_name,
        sellerUrl: product.seller_url,
        productUrl: product.source_url ?? null,
        symmetry: product.symmetry,
        photos: shots,
      };
    });
  } finally {
    db.close();
  }
}

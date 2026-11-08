// Pick the stored photo that best shows a piece from a given camera angle.
// Azimuth is how far the camera has walked around the piece from straight in
// front, positive to the camera's right, so the piece's left side shows on the
// right of the photo. Altitude is how far the camera looks down at the piece's
// middle, 0 level and 90 straight down. Both are in degrees.

// Named views and the azimuth each one is shot from. The negative-azimuth views
// are written as flips of their positive twins so every turn has a stored
// file, except on pieces with no symmetry, where they are shot.
export const VIEWS = {
  front: { azimuth: 0, label: "Front" },
  "one-quarter": { azimuth: -45, label: "One-quarter", mirrorOf: "three-quarter" },
  "three-quarter": { azimuth: 45, label: "Three-quarter" },
  "other-front-side": { azimuth: -67.5, label: "Other side, toward the front", mirrorOf: "front-side" },
  "front-side": { azimuth: 67.5, label: "Side, toward the front" },
  "other-side": { azimuth: -90, label: "Other side", mirrorOf: "side" },
  side: { azimuth: 90, label: "Side" },
  "other-back-side": { azimuth: -112.5, label: "Other side, toward the back", mirrorOf: "back-side" },
  "back-side": { azimuth: 112.5, label: "Side, toward the back" },
  "back-one-quarter": { azimuth: -135, label: "Back one-quarter", mirrorOf: "back-three-quarter" },
  "back-three-quarter": { azimuth: 135, label: "Back three-quarter" },
  back: { azimuth: 180, label: "Back" },
  top: { azimuth: 0, label: "Top", altitude: 90 },
};

/** Flipped views to write for a piece that has `angle`, e.g. side -> other-side. */
export function mirrorsOf(angle) {
  return Object.keys(VIEWS).filter((name) => VIEWS[name].mirrorOf === angle);
}

/**
 * Views a piece needs so pickView can cover every turn. Pieces that stand
 * against a wall are never seen from behind, so they stop at the side.
 */
export function neededViews(symmetry, { againstWall = false } = {}) {
  if (symmetry === "round") return ["front"];
  if (symmetry === "square") return ["front", "three-quarter"];
  if (symmetry === "none") {
    // Left and right differ, so the far-side views are shot rather than flipped.
    const front = ["one-quarter", "front", "three-quarter", "other-front-side", "front-side", "other-side", "side"];
    const back = ["other-back-side", "back-side", "back-one-quarter", "back-three-quarter", "back"];
    return againstWall ? front : [...front, ...back];
  }
  if (symmetry === "rectangle" || againstWall) return ["front", "three-quarter", "front-side", "side"];
  return ["front", "three-quarter", "front-side", "side", "back-side", "back-three-quarter", "back"];
}

// A wrong turn reads worse than a slightly wrong height.
const ALTITUDE_WEIGHT = 0.5;

const TURNS = {
  none: [0],
  mirror: [0],
  rectangle: [0, 180],
  square: [0, 90, 180, 270],
};

function wrap(deg) {
  const d = ((((deg + 180) % 360) + 360) % 360) - 180;
  return d === -180 ? 180 : d;
}

/**
 * Azimuth the camera sees a placed piece from. `turnDeg` is how far the piece
 * is turned from facing the camera square on, positive when its front swings
 * toward the left of the photo. `sightDeg` is how far right of the photo's
 * center the camera looks to reach the piece, atan((x - centerX) / focalPx).
 */
export function viewAzimuth(turnDeg, sightDeg = 0) {
  return wrap(turnDeg - sightDeg);
}

/**
 * Altitude the camera sees a piece's middle from, given how far away it
 * stands along the floor and how tall it is, both in inches.
 */
export function viewAltitude(cameraIn, distanceIn, heightIn) {
  return (Math.atan2(cameraIn - heightIn / 2, distanceIn) * 180) / Math.PI;
}

/**
 * Best stored photo of `product` for a camera at `azimuthDeg`, `altitudeDeg`.
 * Mirror files are skipped: `flip` says to draw the chosen photo flipped
 * left to right instead. Returns { photo, flip, azimuthError, altitudeError },
 * or null when the product has no photos.
 */
export function pickView(product, azimuthDeg, altitudeDeg) {
  const target = wrap(azimuthDeg);
  const symmetry = product.symmetry ?? "mirror";
  const turns = TURNS[symmetry] ?? [0];
  const mirrors = symmetry !== "none";
  let best = null;
  for (const photo of product.photos) {
    if (photo.mirrorOf) continue;
    const altitudeError = Math.abs(altitudeDeg - photo.altitudeDeg);
    for (const flip of mirrors ? [false, true] : [false]) {
      for (const turn of turns) {
        const shown = wrap((flip ? -photo.azimuthDeg : photo.azimuthDeg) + turn);
        const azimuthError = symmetry === "round" ? 0 : Math.abs(wrap(target - shown));
        const cost = azimuthError + ALTITUDE_WEIGHT * altitudeError;
        if (!best || cost < best.cost - 1e-9) {
          best = { photo, flip, azimuthError, altitudeError, cost };
        }
      }
    }
  }
  if (!best) return null;
  const { cost, ...view } = best;
  return view;
}

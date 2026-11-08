// Single-view sizing on a photo whose verticals stand upright. With the eye
// level at row `horizonY` and the camera `cameraIn` inches off the floor, a
// floor point at row y sees (y - horizonY) / cameraIn pixels per inch, both
// across and up. One stick of known height, standing on the floor, fixes
// `cameraIn` for a chosen eye level.

export const DEFAULT_CAMERA_IN = 60;

// Focal length as a share of photo width, about a 75° wide listing lens, for
// when no model measured the lens. It turns pixels per inch into distance.
export const FOCAL_SHARE = 0.65;

const focalOf = (calibration, roomWidth) => calibration.focalPx || FOCAL_SHARE * roomWidth;

export const REFERENCES = [
  { id: "ceiling", label: "Ceiling", inches: 96 },
  { id: "door", label: "Door", inches: 80 },
  { id: "counter", label: "Counter", inches: 36 },
  { id: "outlet", label: "Outlet center", inches: 14 },
];

/** Camera height in inches from a floor-standing stick, or null when the stick does not stand below eye level. */
export function cameraFromStick(stick, horizonY) {
  const tall = stick.bottom - stick.top;
  const below = stick.bottom - horizonY;
  if (!(tall > 1) || !(below > 1) || !(stick.inches > 0)) return null;
  return (stick.inches * below) / tall;
}

/** Eye level that puts the camera `cameraIn` inches up, given the stick. */
export function horizonFromStick(stick, cameraIn = DEFAULT_CAMERA_IN) {
  const pxPerIn = (stick.bottom - stick.top) / stick.inches;
  return stick.bottom - cameraIn * pxPerIn;
}

/** Pixels per inch at floor row `floorY`, or 0 at and above eye level. */
export function pxPerInch(calibration, floorY) {
  const camera = cameraFromStick(calibration.stick, calibration.horizonY);
  if (!camera) return 0;
  return Math.max(0, (floorY - calibration.horizonY) / camera);
}

/**
 * Degrees the camera looks down onto the middle of a piece standing at
 * `item.y`. It grows as the piece comes closer, and is 0 for anything at or
 * above eye level.
 */
export function viewAltitude(calibration, item, product, roomWidth) {
  const camera = cameraFromStick(calibration.stick, calibration.horizonY);
  const k = pxPerInch(calibration, item.y);
  if (!camera || !k) return 0;
  const middle = (item.liftIn ?? 0) + (product.category === "rug" ? 0 : product.heightIn / 2);
  const drop = Math.max(0, camera - middle);
  return (Math.atan2(drop * k, focalOf(calibration, roomWidth)) * 180) / Math.PI;
}

// Shots this high look straight down.
export const TOP_DEG = 80;

// Floor points nearer than this would sit under the camera.
const NEAREST_IN = 6;

const RAD = Math.PI / 180;

/** Wraps degrees into [-180, 180). */
export const wrapDeg = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;

// The room camera: it looks level out of the middle column of the photo, so
// verticals stay upright, `camera` inches above the floor.
function roomCamera(calibration, roomWidth) {
  const camera = cameraFromStick(calibration.stick, calibration.horizonY);
  if (!camera) return null;
  return { camera, f: focalOf(calibration, roomWidth), cx: roomWidth / 2, horizonY: calibration.horizonY };
}

function project(cam, X, h, Z) {
  const z = Math.max(NEAREST_IN, Z);
  return { x: cam.cx + (cam.f * X) / z, y: cam.horizonY + (cam.f * (cam.camera - h)) / z };
}

/** The floor point under room pixel (x, y), in inches across (X) and out (Z) from the camera, or null at or above eye level. */
export function floorAt(calibration, roomWidth, x, y) {
  const cam = roomCamera(calibration, roomWidth);
  if (!cam || !(y - cam.horizonY > 0.5)) return null;
  const Z = (cam.f * cam.camera) / (y - cam.horizonY);
  return { X: ((x - cam.cx) * Z) / cam.f, Z };
}

// The nearest any corner of a piece may come to the camera.
const CLOSEST_IN = 18;

/**
 * The lowest room row a piece's floor point may take, so its footprint stays
 * well in front of the camera at any turn. Rugs and pieces of unknown size
 * may come down to `fallback`.
 */
export function lowestRow(calibration, roomWidth, product, scale, fallback) {
  const cam = roomCamera(calibration, roomWidth);
  if (!cam || product.category === "rug") return fallback;
  const reach = (Math.hypot(product.widthIn, product.depthIn) * (scale ?? 1)) / 2;
  return Math.min(fallback, cam.horizonY + (cam.f * cam.camera) / (CLOSEST_IN + reach));
}

/** Room pixel of floor point (X, Z). */
export function floorToRoom(calibration, roomWidth, X, Z) {
  const cam = roomCamera(calibration, roomWidth);
  return cam ? project(cam, X, 0, Z) : null;
}

// A piece's front faces the camera at yaw 0, and its right side (seen from the
// front) points along +X. Positive yaw turns it clockwise seen from above.
const frontOf = (yawDeg) => ({ x: -Math.sin(yawDeg * RAD), z: -Math.cos(yawDeg * RAD) });
const rightOf = (yawDeg) => ({ x: Math.cos(yawDeg * RAD), z: -Math.sin(yawDeg * RAD) });

/** Yaw that turns a piece's front along floor direction (x, z). */
export const yawFacing = (x, z) => Math.atan2(-x, -z) / RAD;

/**
 * Degrees around a piece the camera stands, in the product photos' terms: 0
 * sees its front, 90 its right side. A piece off to one side of the photo is
 * seen a little from that side even when it faces straight out.
 */
export function viewAzimuth(calibration, item, roomWidth) {
  const at = floorAt(calibration, roomWidth, item.x, item.y);
  if (!at) return wrapDeg(item.yaw ?? 0);
  return wrapDeg((item.yaw ?? 0) + Math.atan2(-at.X, at.Z) / RAD);
}

/** Yaw that shows a piece standing at `item` from photo azimuth `azimuthDeg`. */
export function yawForView(calibration, item, roomWidth, azimuthDeg) {
  const at = floorAt(calibration, roomWidth, item.x, item.y);
  return wrapDeg(azimuthDeg - (at ? Math.atan2(-at.X, at.Z) / RAD : 0));
}

/**
 * A standing piece as a W x D x H box on the floor, centered over its
 * footprint at room pixel `item.x, item.y` and turned by `item.yaw`. Returns
 * its eight corners, each with box coordinates `u` (right), `v` (toward its
 * front), `h` (up from its base), and room pixels `x, y`: the base first,
 * back left, back right, front right, front left, then the same on top.
 */
export function pieceBox(calibration, item, product, roomWidth) {
  const cam = roomCamera(calibration, roomWidth);
  const at = floorAt(calibration, roomWidth, item.x, item.y);
  if (!cam || !at) return null;
  const size = item.scale ?? 1;
  const w = (product.widthIn * size) / 2;
  const d = (product.depthIn * size) / 2;
  const tall = product.heightIn * size;
  const lift = item.liftIn ?? 0;
  const front = frontOf(item.yaw ?? 0);
  const right = rightOf(item.yaw ?? 0);
  const corners = [];
  for (const h of [0, tall]) {
    for (const [u, v] of [[-w, -d], [w, -d], [w, d], [-w, d]]) {
      const X = at.X + u * right.x + v * front.x;
      const Z = at.Z + u * right.z + v * front.z;
      corners.push({ u, v, h, ...project(cam, X, lift + h, Z) });
    }
  }
  return corners;
}

/**
 * Where box corners fall in a product photo, in its pixels. The photo is
 * taken as a distant view from its azimuth and altitude, and the box's
 * outline is stretched onto `content`, the cutout's opaque box, which also
 * absorbs a mistagged altitude. `flip` mirrors the photo.
 */
export function photoCorners(corners, photo, content, flip) {
  const az = (photo?.azimuthDeg ?? 0) * RAD;
  const alt = (photo?.altitudeDeg ?? 0) * RAD;
  // A mirrored photo shows the piece's right side where its left was.
  const flat = corners.map(({ u: right, v, h }) => {
    const u = flip ? -right : right;
    const toward = u * Math.sin(az) + v * Math.cos(az);
    return { x: u * Math.cos(az) - v * Math.sin(az), y: toward * Math.sin(alt) - h * Math.cos(alt) };
  });
  const xs = flat.map((p) => p.x);
  const ys = flat.map((p) => p.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const spanX = Math.max(...xs) - x0 || 1;
  const spanY = Math.max(...ys) - y0 || 1;
  return flat.map((p) => {
    const x = content.x + ((p.x - x0) / spanX) * content.w;
    return {
      x: flip ? 2 * content.x + content.w - x : x,
      y: content.y + ((p.y - y0) / spanY) * content.h,
    };
  });
}

// Photos tagged within this many degrees of straight on, or of a side, keep
// their tag: their bottom edge runs level, so the lowest column says nothing.
const AXIS_DEG = 10;

// Photos that came from a listing, at whatever angle it was shot. Generated
// views were made at their tagged angle.
const SHOT_SOURCES = new Set(["unknown", "retailer", "upload", "warped"]);

/**
 * The azimuth a corner-on listing photo was really taken from, since a
 * listing's "three-quarter" shot may be 20° round, or of the other side.
 * The nearest base corner stands lowest in the shot, over `content.lowX`;
 * of the two angles that put it there, one per side, the one showing the
 * front (or back) wider than the side wins, as product shots do. Thin
 * panels like TVs only take its side. Rugs,
 * square and round pieces, and generated views keep their tags.
 */
export function fittedAzimuth(product, photo, content) {
  const tagged = photo?.azimuthDeg ?? 0;
  const original = photo?.source === "mirror" ? product.photos.find((p) => p.angle === photo.mirrorOf && p.altitudeDeg === photo.altitudeDeg) : photo;
  const offAxis = Math.abs(wrapDeg(tagged - Math.round(tagged / 90) * 90));
  if (
    product.category === "rug" ||
    product.symmetry === "square" ||
    product.symmetry === "round" ||
    !SHOT_SOURCES.has(original?.source) ||
    !(content?.lowX >= 0) ||
    offAxis < AXIS_DEG
  ) {
    return tagged;
  }
  const w = product.widthIn / 2;
  const d = product.depthIn / 2;
  const box = [0, product.heightIn].flatMap((h) => [[-w, -d], [w, -d], [w, d], [-w, d]].map(([u, v]) => ({ u, v, h })));
  const facing = Math.abs(wrapDeg(tagged)) < 90 ? 0 : 180;
  let best = null;
  for (let az = facing - 90 + AXIS_DEG; az <= facing + 90 - AXIS_DEG; az += 1) {
    const turn = Math.abs(az - facing) * RAD;
    if (turn < AXIS_DEG * RAD || product.widthIn * Math.cos(turn) < product.depthIn * Math.sin(turn)) continue;
    const pts = photoCorners(box, { ...photo, azimuthDeg: az }, content, false);
    const near = pts.slice(0, 4).reduce((a, b) => (b.y > a.y ? b : a));
    const miss = Math.abs(near.x - content.lowX);
    if (!best || miss < best.miss - 1e-6) best = { az, miss };
  }
  if (!best) return tagged;
  // A thin panel's nearest corner sits at its end at any turn, so only its side tells.
  if (product.depthIn < THIN_SHARE * product.widthIn) {
    const side = Math.sign(wrapDeg(best.az - facing)) === Math.sign(wrapDeg(tagged - facing)) ? 1 : -1;
    return wrapDeg(facing + side * wrapDeg(tagged - facing));
  }
  return wrapDeg(best.az);
}

const THIN_SHARE = 0.25;

// Smallest face, in square pixels, worth drawing.
const FACE_MIN_PX2 = 16;

const windingArea = (q) => {
  let sum = 0;
  for (let i = 0; i < q.length; i++) {
    const a = q[i];
    const b = q[(i + 1) % q.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
};

// Seat height as a share of overall height, for pieces whose back rises
// above their seat. Everything else is a plain box with a flat top.
const SEAT_SHARE = { sofa: 0.55, chair: 0.5, bench: 0.6, bed: 0.35 };

/** How far up a piece's flat top sits, as a share of its height: 1 unless it has a back. */
export const seatShare = (category) => SEAT_SHARE[category] ?? 1;

// Upright faces by base corner, left then right as seen from outside.
const UPRIGHT = { left: [0, 3], front: [3, 2], right: [2, 1], back: [1, 0] };

const lerpPt = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// The row of the line through a and b at column x, or null when it stands upright.
const rowOn = (a, b) => (Math.abs(b.x - a.x) < 2 ? null : (x) => a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x));

/**
 * How a piece's photo is carried into the room, part by part in drawing
 * order. Each part maps its `photo` quad onto its `room` quad (photo and
 * room pixels) and carries `region`, a convex part of the photo. Together
 * the regions cover all of `content`, the cutout's opaque box, since a
 * product photo's own perspective lets the piece spill past the box.
 *
 * The piece is a box up to its seat (`seat`, a share of its height; 1 for
 * a flat top), with a flat seat on top and, past the seat, its back
 * standing at the far side. The photo is cut into upright columns at the
 * box's upright edges. Up a column, it rides on that column's face, then
 * the seat, then the back. Each meets the next along an edge they share,
 * so nothing steps or bends. A face the photo shows but the room camera
 * sees edge-on or from behind is left out. `corners` comes from `pieceBox`
 * and `photoPts` from `photoCorners`.
 */
export function sharedFaces(corners, photoPts, content, seat = 1) {
  const room = corners.map((c) => ({ x: c.x, y: c.y }));
  const level = (pts, t) => [0, 1, 2, 3].map((i) => lerpPt(pts[i], pts[i + 4], t));
  const photo = { base: photoPts.slice(0, 4), seat: level(photoPts, seat), top: photoPts.slice(4) };
  const inRoom = { base: room.slice(0, 4), seat: level(room, seat), top: room.slice(4) };
  const quad = (pick) => ({ photo: pick(photo), room: pick(inRoom) });
  const usable = (q, needRoom = true) =>
    Math.abs(windingArea(q.photo)) > FACE_MIN_PX2 && (!needRoom || windingArea(q.room) > FACE_MIN_PX2);

  const faces = Object.entries(UPRIGHT)
    .map(([id, [l, r]]) => ({ id, ...quad((p) => [p.seat[l], p.seat[r], p.base[r], p.base[l]]) }))
    .filter((face) => windingArea(face.photo) > FACE_MIN_PX2)
    .sort((a, b) => a.photo[3].x - b.photo[3].x);
  const seen = faces.filter((face) => windingArea(face.room) > FACE_MIN_PX2);
  const seatTop = quad((p) => p.seat);
  if (!faces.length || !seen.length) {
    return usable(seatTop) ? [{ id: "top", ...seatTop, region: rectQuad(content) }] : [];
  }
  const back = quad((p) => [p.top[1], p.top[0], p.base[0], p.base[1]]);
  const hasBack = seat < 1 && usable(back, false);
  const seatPlane = usable(seatTop) ? seatTop : null;
  const backLine = hasBack ? rowOn(photo.seat[0], photo.seat[1]) : null;

  const topY = content.y - 2;
  const bottomY = content.y + content.h + 2;
  const clampY = (y) => Math.min(bottomY, Math.max(topY, y));
  const parts = { back: [], seat: [], faces: [] };
  faces.forEach((face, i) => {
    if (!seen.includes(face)) return;
    const [sl, sr, , bl] = face.photo;
    const xl = i === 0 ? Math.min(bl.x, content.x - 2) : bl.x;
    const xr = i === faces.length - 1 ? Math.max(face.photo[2].x, content.x + content.w + 2) : face.photo[2].x;
    const edge = rowOn(sl, sr) ?? (() => Math.min(sl.y, sr.y));
    const y1 = [clampY(edge(xl)), clampY(edge(xr))];
    const y2 = backLine ? [Math.min(y1[0], clampY(backLine(xl))), Math.min(y1[1], clampY(backLine(xr)))] : [topY, topY];
    const band = (lo, hi) => [{ x: xl, y: hi[0] }, { x: xr, y: hi[1] }, { x: xr, y: lo[1] }, { x: xl, y: lo[0] }];
    const tall = (lo, hi) => lo[0] - hi[0] > 0.5 || lo[1] - hi[1] > 0.5;
    parts.faces.push({ id: face.id, photo: face.photo, room: face.room, region: band([bottomY, bottomY], y1) });
    if (tall(y1, y2)) {
      const plane = seatPlane ?? face;
      parts.seat.push({ id: `${face.id}-seat`, photo: plane.photo, room: plane.room, region: band(y1, y2) });
    }
    if (backLine && tall(y2, [topY, topY])) {
      parts.back.push({ id: `${face.id}-back`, photo: back.photo, room: back.room, region: band(y2, [topY, topY]) });
    }
  });
  return [...parts.back, ...parts.seat, ...parts.faces];
}

const rectQuad = (r) => [
  { x: r.x, y: r.y },
  { x: r.x + r.w, y: r.y },
  { x: r.x + r.w, y: r.y + r.h },
  { x: r.x, y: r.y + r.h },
];


// Wall snapping reads the model's floor line, the edge where floor meets wall.
const WALL_SPAN_IN = 30;
const WALL_RMS_IN = 2.5;
const FARTHEST_IN = 600;
export const SNAP_IN = 4;

/** The floor line as floor points in inches, keeping only stretches in front of the camera. */
export function wallPoints(calibration, roomWidth, floorLine) {
  if (!floorLine?.length) return [];
  return floorLine
    .map((p) => floorAt(calibration, roomWidth, p.x, p.y))
    .filter((p) => p && p.Z > NEAREST_IN * 2 && p.Z < FARTHEST_IN);
}

// The straight wall through floor-line point `i`: a line fit to its
// neighbors within WALL_SPAN_IN, or null where the line bends or is ragged.
function wallAt(points, i) {
  const near = points.filter((p) => Math.hypot(p.X - points[i].X, p.Z - points[i].Z) <= WALL_SPAN_IN);
  if (near.length < 4) return null;
  const mx = near.reduce((s, p) => s + p.X, 0) / near.length;
  const mz = near.reduce((s, p) => s + p.Z, 0) / near.length;
  let xx = 0;
  let xz = 0;
  let zz = 0;
  for (const p of near) {
    xx += (p.X - mx) ** 2;
    xz += (p.X - mx) * (p.Z - mz);
    zz += (p.Z - mz) ** 2;
  }
  const angle = Math.atan2(2 * xz, xx - zz) / 2;
  const t = { x: Math.cos(angle), z: Math.sin(angle) };
  const off = near.map((p) => (p.X - mx) * -t.z + (p.Z - mz) * t.x);
  const rms = Math.sqrt(off.reduce((s, o) => s + o * o, 0) / off.length);
  if (rms > WALL_RMS_IN) return null;
  // The wall's normal pointing into the room, toward the camera.
  let n = { x: -t.z, z: t.x };
  if (n.x * -mx + n.z * -mz < 0) n = { x: -n.x, z: -n.z };
  return { x: mx, z: mz, n };
}

// The straight wall nearest `at`. Corners and ragged stretches have no
// single wall, so the next nearest floor-line points get a turn.
function nearestWall(walls, at) {
  if (walls.length < 4) return null;
  const order = walls
    .map((p, i) => ({ i, dist: Math.hypot(p.X - at.X, p.Z - at.Z) }))
    .sort((a, b) => a.dist - b.dist);
  const reach = order[0].dist + WALL_SPAN_IN * 2;
  for (const { i, dist } of order) {
    if (dist > reach) break;
    const wall = wallAt(walls, i);
    if (wall) return wall;
  }
  return null;
}

/** Yaw that lines a piece standing at `item` up with the wall the camera sees behind it, facing into the room, or null. */
export function wallYaw(calibration, roomWidth, walls, item) {
  const at = floorAt(calibration, roomWidth, item.x, item.y);
  if (!at || walls.length < 4) return null;
  const ray = at.X / at.Z;
  let best = -1;
  let bestOff = Infinity;
  walls.forEach((p, i) => {
    const off = Math.abs(p.X / p.Z - ray);
    if (p.Z > at.Z && off < bestOff) {
      best = i;
      bestOff = off;
    }
  });
  const wall = best >= 0 ? wallAt(walls, best) : null;
  return wall ? yawFacing(wall.n.x, wall.n.z) : null;
}

/**
 * Backs a piece against the nearest wall when its back comes within SNAP_IN
 * of it or pushes past it: returns the snapped `{ x, y, yaw }` in room
 * pixels, or null.
 */
export function snapToWall(calibration, roomWidth, walls, item, product) {
  let at = floorAt(calibration, roomWidth, item.x, item.y);
  if (!at || walls.length < 4) return null;
  // Past the floor line, the piece comes back to the wall the camera sees in that column.
  const ray = at.X / at.Z;
  const seen = walls.reduce((best, p) => (Math.abs(p.X / p.Z - ray) < Math.abs(best.X / best.Z - ray) ? p : best));
  if (at.Z > seen.Z) at = seen;
  const wall = nearestWall(walls, at);
  if (!wall) return null;
  const half = (product.depthIn * (item.scale ?? 1)) / 2;
  const out = (at.X - wall.x) * wall.n.x + (at.Z - wall.z) * wall.n.z;
  // A piece pushed into or through the wall comes back out in front of it.
  if (out - half > SNAP_IN) return null;
  const gap = half + 0.5;
  let X = at.X + (gap - out) * wall.n.x;
  let Z = at.Z + (gap - out) * wall.n.z;
  // Slide along the wall out of a neighboring wall it runs into at a corner.
  const along = { x: -wall.n.z, z: wall.n.x };
  const width = (product.widthIn * (item.scale ?? 1)) / 2;
  let slide = 0;
  for (const [a, d] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx = X + a * width * along.x + d * half * wall.n.x;
    const cz = Z + a * width * along.z + d * half * wall.n.z;
    const side = nearestWall(walls, { X: cx, Z: cz });
    if (!side || side.n.x * wall.n.x + side.n.z * wall.n.z > 0.5) continue;
    const depth = (cx - side.x) * side.n.x + (cz - side.z) * side.n.z;
    const push = along.x * side.n.x + along.z * side.n.z;
    if (depth < 0 && Math.abs(push) > 0.3) {
      const need = -depth / push;
      if (Math.abs(need) > Math.abs(slide)) slide = need;
    }
  }
  if (Math.abs(slide) < 2 * width) {
    X += (slide + Math.sign(slide) * 0.5) * along.x;
    Z += (slide + Math.sign(slide) * 0.5) * along.z;
  }
  const p = floorToRoom(calibration, roomWidth, X, Z);
  return p && { x: p.x, y: p.y, yaw: yawFacing(wall.n.x, wall.n.z) };
}

/**
 * A rug's footprint on screen, in room pixels: its bounding box, the pixels
 * per inch at its center, and `quad`, its corners laid on the floor.
 */
export function placementBox(calibration, item, product, roomWidth) {
  const k = pxPerInch(calibration, item.y) * (item.scale ?? 1);
  if (!k) return null;
  const quad = rugQuad(calibration, item, product, roomWidth);
  if (!quad) return null;
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y, pxPerInch: k, quad };
}

export const RUG_TILT_DEG = { min: 5, max: 85, step: 5 };

const clampDeg = (deg) => Math.min(RUG_TILT_DEG.max, Math.max(RUG_TILT_DEG.min, deg));

/**
 * A rug's corners on the floor, in room pixels: back left, back right, front
 * right, front left. `item.x, item.y` is its center, and `item.yaw` turns
 * it on the floor. The camera looks out from the middle column of the photo.
 * A set `item.altitude` overrides how steeply the camera looks down at it,
 * keeping its center and its width there.
 */
export function rugQuad(calibration, item, product, roomWidth) {
  const trueCamera = cameraFromStick(calibration.stick, calibration.horizonY);
  const drop = item.y - calibration.horizonY;
  if (!trueCamera || !(drop > 0)) return null;
  const f = focalOf(calibration, roomWidth);
  const cx = roomWidth / 2;
  const z0 = (f * trueCamera) / drop;
  let camera = trueCamera;
  let horizonY = calibration.horizonY;
  if (item.altitude != null) {
    camera = z0 * Math.tan((clampDeg(item.altitude) * Math.PI) / 180);
    horizonY = item.y - (f * camera) / z0;
  }
  const x0 = ((item.x - cx) * z0) / f;
  const size = item.scale ?? 1;
  const w = (product.widthIn * size) / 2;
  const d = (product.depthIn * size) / 2;
  const t = ((item.yaw ?? 0) * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const corner = (lx, lz) => {
    const X = x0 + lx * cos - lz * sin;
    const Z = Math.max(NEAREST_IN, z0 + lx * sin + lz * cos);
    return { x: cx + (f * X) / Z, y: horizonY + (f * camera) / Z };
  };
  return [corner(-w, d), corner(w, d), corner(w, -d), corner(-w, -d)];
}

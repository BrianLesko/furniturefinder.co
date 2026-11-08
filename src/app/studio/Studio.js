"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { assessStraightenCandidate } from "@/lib/candidate";
import {
  invertHomography,
  paintMapped,
  quadHomography,
  straightenQuad,
  straightenVerticals,
  warpInfo,
} from "@/lib/perspective";
import { calibrationFromGeometry, fromLayoutService, geometryInRoom } from "@/lib/geometry";
import { PRESETS } from "@/lib/presets";
import { roomTypeForSrc } from "@/lib/room-type";
import { bestSupported } from "@/lib/ranking";
import RoomPicker from "@/components/RoomPicker";
import FurnitureList from "../dashboard/FurnitureList";
import SavedRooms from "../dashboard/SavedRooms";
import UnlockModal from "@/components/UnlockModal";
import StraightenMorph from "@/components/StraightenMorph";
import { drawGap, gapAt, gapRegions } from "@/lib/gaps";
import { uprightPlan } from "@/lib/upright";
import {
  REFERENCES,
  RUG_TILT_DEG,
  TOP_DEG,
  cameraFromStick,
  horizonFromStick,
  lowestRow,
  fittedAzimuth,
  photoCorners,
  pieceBox,
  placementBox,
  pxPerInch,
  seatShare,
  sharedFaces,
  snapToWall,
  viewAltitude,
  viewAzimuth,
  wallPoints,
  wrapDeg,
  yawForView,
} from "@/lib/scale";

const MAX_EDGE = 2000;
const LAYOUT_VARIANT = "mp3d";
const ALPHA_CUT = 16;
// Click testing reads a cutout's alpha at most this many pixels across.
const ALPHA_EDGE = 512;
// Screen pixels of slack around a piece's edge when clicking it.
const HIT_SLACK = 3;

// How long a removed piece takes to fade out, matching .piece-leaving.
const LEAVE_MS = 320;
// Hero pieces start once the card and photo have mostly settled.
const ENTER_AFTER_MS = 900;
const ENTER_STAGGER_MS = 220;

const STEPS = [
  { id: "photo", label: "Photo" },
  { id: "straighten", label: "Straighten & scale" },
  { id: "pieces", label: "Pieces" },
  { id: "render", label: "Render" },
];

const STRAIGHTEN = [
  { id: "upright", label: "Upright" },
  { id: "wall", label: "Four corners" },
  { id: "verticals", label: "Two lines" },
  { id: "none", label: "As shot" },
];

// A doorway leaves a hole in the floor line. Drawn as one polyline, that hole
// becomes a wall. Each stretch is its own line.
function lineParts(line) {
  if (!line?.length) return [];
  const span = line[line.length - 1].x - line[0].x;
  const gap = Math.max(24, span * 0.03);
  const parts = [];
  let cur = [line[0]];
  for (let i = 1; i < line.length; i++) {
    if (line[i].x - cur[cur.length - 1].x > gap) {
      if (cur.length > 1) parts.push(cur);
      cur = [line[i]];
    } else cur.push(line[i]);
  }
  if (cur.length > 1) parts.push(cur);
  return parts;
}

// Voted methods this page can run, so the vote ranking picks the default.
const RANKED_OPTIONS = {
  "plumb-v1": "upright",
  "plumb-v2": "upright",
  "lines-v1": "verticals",
  "corners-v1": "wall",
  "original-v1": "none",
};
// Until there are votes to rank by (no votes file in production), use the
// last known leader.
const DEFAULT_STRAIGHTEN = "upright";

const turnDelta = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

const viewLabel = (angle) => angle.charAt(0).toUpperCase() + angle.slice(1).replace(/-/g, " ");

// Photos this close in camera height belong to one trip around the piece. A
// steeper set, such as 25° next to 10°, is a separate trip.
const ALTITUDE_TIER = 8;

function altitudeTier(product, altitude) {
  const levels = [...new Set(product.photos.map((photo) => photo.altitudeDeg).filter((deg) => deg < TOP_DEG))].sort(
    (a, b) => a - b,
  );
  const tiers = [];
  for (const level of levels) {
    const last = tiers.at(-1);
    if (last && level - last.at(-1) <= ALTITUDE_TIER) last.push(level);
    else tiers.push([level]);
  }
  if (!tiers.length || altitude == null) return null;
  return tiers.reduce((best, tier) =>
    Math.min(...tier.map((level) => Math.abs(level - altitude))) <
    Math.min(...best.map((level) => Math.abs(level - altitude)))
      ? tier
      : best,
  );
}

function azimuthsOf(product, altitude) {
  const tier = altitudeTier(product, altitude);
  const around = product.photos.filter(
    (photo) => photo.altitudeDeg < TOP_DEG && (!tier || tier.some((level) => Math.abs(photo.altitudeDeg - level) < 0.5)),
  );
  const list = (around.length ? around : product.photos).map((photo) => photo.azimuthDeg);
  return [...new Set(list)].sort((a, b) => a - b);
}

// Shots seen from this azimuth. Top-down shots belong to every azimuth.
function shotsAt(product, azimuth) {
  const shots = product.photos.filter((photo) => photo.altitudeDeg >= TOP_DEG || turnDelta(photo.azimuthDeg, azimuth) < 1);
  return shots.length ? shots : product.photos;
}

function photoFor(product, azimuth, altitude) {
  let best = null;
  for (const photo of shotsAt(product, azimuth)) {
    const score = Math.abs(photo.altitudeDeg - altitude) + turnDelta(photo.azimuthDeg, azimuth) / 1000;
    if (!best || score < best.score) best = { photo, score };
  }
  return best?.photo ?? null;
}

// Right turns toward higher azimuth, the way the pick cards show three-quarter
// on the right, staying at `altitude`. Past the last view it comes back
// around to the first.
function turnAzimuth(product, azimuth, direction, altitude) {
  let next = null;
  for (const candidate of azimuthsOf(product, altitude)) {
    const delta = (((candidate - azimuth) * direction) % 360 + 360) % 360;
    if (delta < 1) continue;
    if (!next || delta < next.delta) next = { candidate, delta };
  }
  return next?.candidate ?? null;
}

// Front, back, right, and left: which sides a camera this many degrees
// around a piece sees more than a sliver of.
function sidesSeen(azimuth) {
  const t = (azimuth * Math.PI) / 180;
  const sliver = 0.17;
  return [Math.cos(t) > sliver, Math.cos(t) < -sliver, Math.sin(t) > sliver, Math.sin(t) < -sliver];
}

// The photo view to draw a piece seen from `azimuth`: the nearest one that
// shows every side the room sees, since a side missing from the photo
// cannot be drawn.
function shownAzimuth(product, azimuth, altitude = null) {
  const want = sidesSeen(azimuth);
  // A chosen camera height stays on photos taken from that height. Auto may
  // use every height, so a nearer shot can win.
  const exact =
    altitude == null
      ? []
      : [...new Set(product.photos.filter((photo) => Math.abs(photo.altitudeDeg - altitude) < 0.5).map((photo) => photo.azimuthDeg))].sort(
          (a, b) => a - b,
        );
  let best = null;
  for (const a of exact.length ? exact : azimuthsOf(product, altitude)) {
    const has = sidesSeen(a);
    const missing = want.filter((w, i) => w && !has[i]).length;
    const score = turnDelta(a, azimuth) + 30 * missing;
    if (!best || score < best.score) best = { a, score };
  }
  return best?.a ?? 0;
}

// The next camera height of this same view, such as the steeper three-quarter.
// Past the steepest it comes back to the flattest, and the other way around.
function tiltAltitude(product, photo, direction) {
  const levels = [...new Set(product.photos.filter((shot) => shot.angle === photo.angle).map((shot) => shot.altitudeDeg))].sort(
    (a, b) => a - b,
  );
  if (levels.length < 2) return null;
  const step = direction > 0 ? 1 : -1;
  let index = levels.findIndex((a) => Math.abs(a - photo.altitudeDeg) < 0.5);
  if (index < 0) {
    index = direction > 0 ? levels.findIndex((a) => a > photo.altitudeDeg + 0.5) : levels.findLastIndex((a) => a < photo.altitudeDeg - 0.5);
    if (index < 0) index = direction > 0 ? 0 : levels.length - 1;
  } else {
    index = (index + step + levels.length) % levels.length;
  }
  const next = levels[index];
  return product.photos.find((shot) => shot.angle === photo.angle && Math.abs(shot.altitudeDeg - next) < 0.5) ?? null;
}

const press =
  "inline-flex items-center justify-center rounded-full border-ink font-bold no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#1a1a1a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none cursor-pointer disabled:cursor-default disabled:opacity-50";

const chip = (active) =>
  `cursor-pointer rounded-full border-2 border-ink px-3 py-1 font-mono text-[12px] font-bold transition disabled:cursor-default disabled:opacity-40 ${
    active ? "bg-hot text-white" : "bg-white hover:bg-cream"
  }`;

const panel = "rounded-[22px] border-[3px] border-ink bg-white p-4 shadow-[6px_6px_0_0_#1a1a1a]";
const deckHeading =
  "m-0 font-display text-[clamp(1.8rem,4vw,2.4rem)] leading-none tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:1.5px_#1a1a1a] [paint-order:stroke_fill]";
const handle =
  "absolute z-30 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none place-items-center rounded-full border-[3px] border-ink shadow-[3px_3px_0_0_#1a1a1a] active:cursor-grabbing";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

// The opaque box of a cutout, in its own pixels. Pieces are sized from this,
// not from the padded canvas they were saved on.
function opaqueBox(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] <= ALPHA_CUT) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const alphaScale = Math.min(1, ALPHA_EDGE / Math.max(w, h));
  const aw = Math.max(1, Math.round(w * alphaScale));
  const ah = Math.max(1, Math.round(h * alphaScale));
  const alpha = new Uint8Array(aw * ah);
  for (let ay = 0; ay < ah; ay++) {
    const y = Math.min(h - 1, Math.floor((ay + 0.5) / alphaScale));
    for (let ax = 0; ax < aw; ax++) {
      const x = Math.min(w - 1, Math.floor((ax + 0.5) / alphaScale));
      alpha[ay * aw + ax] = data[(y * w + x) * 4 + 3];
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w, h, natW: w, natH: h, corners: null, alpha, alphaScale, aw, ah };
  // The middle of what reaches into the lowest rows: a corner-on piece's
  // nearest corner, which stands lowest in the shot.
  let sumX = 0;
  let count = 0;
  for (let y = Math.max(minY, maxY - Math.max(1, Math.round((maxY - minY) * 0.01))); y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (data[(y * w + x) * 4 + 3] <= ALPHA_CUT) continue;
      sumX += x + 0.5;
      count += 1;
    }
  }
  const mask = { alpha, alphaScale, aw, ah, lowX: sumX / count };
  // A rug shot is a four-sided shape: its outer pixels just inside the top
  // and bottom rows are its back and front corners.
  const inset = Math.max(1, Math.round((maxY - minY) * 0.01));
  const ends = (y) => {
    let left = -1;
    let right = -1;
    for (let x = minX; x <= maxX; x++) {
      if (data[(y * w + x) * 4 + 3] <= ALPHA_CUT) continue;
      if (left < 0) left = x;
      right = x + 1;
    }
    return left < 0 ? null : [left, right];
  };
  const top = ends(minY + inset);
  const bottom = ends(maxY - inset);
  const corners =
    top && bottom
      ? [
          { x: top[0], y: minY },
          { x: top[1], y: minY },
          { x: bottom[1], y: maxY + 1 },
          { x: bottom[0], y: maxY + 1 },
        ]
      : null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, natW: w, natH: h, corners, ...mask };
}

function opaqueAt(content, x, y) {
  if (!(x >= 0 && y >= 0 && x < content.natW && y < content.natH)) return false;
  const ax = Math.min(content.aw - 1, Math.floor(x * content.alphaScale));
  const ay = Math.min(content.ah - 1, Math.floor(y * content.alphaScale));
  return content.alpha[ay * content.aw + ax] > ALPHA_CUT;
}

function applyHomography(H, x, y) {
  const d = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / d, y: (H[3] * x + H[4] * y + H[5]) / d };
}

// A rug is drawn from its top shot when it has one, else its front shot, laid
// onto the floor. Its other shots are the same rug from fixed cameras.
function rugPhoto(product) {
  return (
    product.photos.find((photo) => photo.altitudeDeg >= TOP_DEG) ??
    product.photos.find((photo) => photo.angle === "front") ??
    product.photos[0]
  );
}

function rugCorners(content, flip) {
  const c = content.corners;
  return flip ? [c[1], c[0], c[3], c[2]] : c;
}

function cssMatrix(H) {
  const n = H.map((v) => v / H[8]);
  return `matrix3d(${n[0]},${n[3]},0,${n[6]},${n[1]},${n[4]},0,${n[7]},0,0,1,0,${n[2]},${n[5]},0,1)`;
}

// H scaled to the stage on screen, and moved to start at the top left of
// `origin`, the corner of the element it transforms.
function stageMatrix(H, shown, origin) {
  const [a, b, c, d, e, f, g, h, i] = H;
  const x = origin?.x ?? 0;
  const y = origin?.y ?? 0;
  return [
    a * shown,
    b * shown,
    (a * x + b * y + c) * shown,
    d * shown,
    e * shown,
    (d * x + e * y + f) * shown,
    g,
    h,
    g * x + h * y + i,
  ];
}

// A standing piece's photo drawn flat. Width follows the projected box so the
// piece stays the right size in the room, and height uses that same scale so
// the photo is not stretched taller than it was shot. The feet stay on the
// floor of the box. `flip` mirrors it.
function flatFace(corners, content, flip) {
  const bounds = boundsOf(corners);
  const sx = bounds.width / content.w;
  if (!(sx > 0)) return null;
  const sy = sx;
  const sign = flip ? -1 : 1;
  const midX = bounds.x + bounds.width / 2;
  const bottom = bounds.y + bounds.height;
  const H = [sign * sx, 0, midX - sign * sx * (content.x + content.w / 2), 0, sy, bottom - sy * (content.y + content.h), 0, 0, 1];
  const rect = [
    { x: content.x, y: content.y },
    { x: content.x + content.w, y: content.y },
    { x: content.x + content.w, y: content.y + content.h },
    { x: content.x, y: content.y + content.h },
  ];
  const room = rect.map((p) => applyHomography(H, p.x, p.y));
  return { id: "flat", photo: rect, room, region: rect, H, back: invertHomography(H) };
}

// A standing piece drawn as the box faces its photo and the room both see,
// each carried in perspective from the photo onto the room. Without `warp`,
// its photo is drawn flat instead.
function standingFaces(calibration, item, product, photo, content, roomWidth, warp = true) {
  const corners = pieceBox(calibration, item, product, roomWidth);
  if (!corners) return null;
  if (!warp) {
    const face = flatFace(corners, content, item.flip);
    return face ? { corners, faces: [face] } : null;
  }
  const faces = sharedFaces(corners, photoCorners(corners, photo, content, item.flip), content, seatShare(product.category))
    .map((face) => {
      const solved = quadHomography(face.photo, face.room);
      if (!solved) return null;
      // The same map either sign; drawing needs it positive over the face.
      const flipSign = face.photo.every((p) => solved[6] * p.x + solved[7] * p.y + solved[8] < 0);
      const H = flipSign ? solved.map((v) => -v) : solved;
      const back = invertHomography(H);
      if (!back) return null;
      const depth = (p) => H[6] * p.x + H[7] * p.y + H[8];
      const near = Math.min(...face.photo.map(depth));
      if (!(near > 0)) return null;
      // Past the face, the map runs off toward its vanishing line, so the
      // region stops well short of it.
      const region = clipBelow(face.region, depth, near * HORIZON_MARGIN);
      return region.length >= 3 ? { ...face, region, H, back } : null;
    })
    .filter(Boolean);
  return faces.length ? { corners, faces } : null;
}

// How close to its vanishing line a part may reach, as a share of how near
// its own face comes.
const HORIZON_MARGIN = 0.25;

// The part of convex polygon `poly` where the linear `value` is at least `min`.
function clipBelow(poly, value, min) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const va = value(a) - min;
    const vb = value(b) - min;
    if (va >= 0) out.push(a);
    if (va >= 0 !== vb >= 0) {
      const t = va / (va - vb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

function insideQuad(q, p) {
  let sign = 0;
  for (let i = 0; i < q.length; i++) {
    const a = q[i];
    const b = q[(i + 1) % q.length];
    const z = Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
    if (!z) continue;
    if (!sign) sign = z;
    else if (z !== sign) return false;
  }
  return true;
}

// A face's outline pushed out a pixel, so neighboring faces meet without a hairline.
function grown(q) {
  const cx = q.reduce((s, p) => s + p.x, 0) / q.length;
  const cy = q.reduce((s, p) => s + p.y, 0) / q.length;
  return q.map((p) => {
    const d = Math.hypot(p.x - cx, p.y - cy) || 1;
    return { x: p.x + (p.x - cx) / d, y: p.y + (p.y - cy) / d };
  });
}

const boundsOf = (pts) => {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

const RUG_TURN_DEG = 15;
const FINE_TURN_DEG = 5;
const SIZE_MIN = 0.25;
const SIZE_MAX = 3;
const SIZE_STEP = 0.01;
// One tap of Shift, Command, or Control with up or down.
const SIZE_CHUNK = 0.1;
// Holding that combo eases the size instead of repeating the chunk. A second
// of holding moves less than one tap, so it is easy to stop on a size.
const SIZE_HOLD_PER_SEC = 0.08;
const SIZE_HOLD_DELAY_MS = 280;

function clampSize(scale) {
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, scale));
}

// One step steeper or flatter, landing on whole steps.
function tiltRug(altitude, direction) {
  const { min, max, step } = RUG_TILT_DEG;
  return clamp(Math.round((altitude + direction * step) / step) * step, min, max);
}

function flatCanvas(img) {
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The canvas could not be encoded."))), "image/png");
  });
}

// The wall's left edge, or the longer upright, runs floor to ceiling when the
// check fit it, so it is the first height reference.
let morphCount = 0;

// The quick straighten animation from one render of the photo to the next,
// as corners in fractions of the stage, or null when nothing visibly moves.
function morphBetween(previous, next, image) {
  if (!next.corners || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  let from = previous?.src === next.src ? previous.corners : null;
  if (!from) {
    const s = Math.min(next.w / next.natural.w, next.h / next.natural.h);
    const fw = (next.natural.w * s) / next.w;
    const fh = (next.natural.h * s) / next.h;
    const [x0, y0] = [(1 - fw) / 2, (1 - fh) / 2];
    from = [
      { x: x0, y: y0 },
      { x: x0 + fw, y: y0 },
      { x: x0 + fw, y: y0 + fh },
      { x: x0, y: y0 + fh },
    ];
  }
  const moved = from.some((p, i) => Math.hypot(p.x - next.corners[i].x, p.y - next.corners[i].y) > 0.004);
  if (!moved) return null;
  morphCount += 1;
  return { key: morphCount, image, from, to: next.corners };
}

function referenceStick(mode, fit, info) {
  if (!fit || !info) return null;
  const pairs = mode === "wall" ? [[fit[0], fit[3]]] : [[fit[0], fit[1]], [fit[2], fit[3]]];
  let best = null;
  for (const [a, b] of pairs) {
    const top = info.toOutput(a.y < b.y ? a : b);
    const bottom = info.toOutput(a.y < b.y ? b : a);
    if (!top || !bottom) continue;
    const stick = { x: (top.x + bottom.x) / 2, top: top.y, bottom: bottom.y };
    if (!best || stick.bottom - stick.top > best.bottom - best.top) best = stick;
  }
  return best;
}

function startCalibration(room) {
  const { w, h, reference } = room;
  const usable =
    reference &&
    reference.bottom - reference.top > 0.15 * h &&
    reference.top >= -0.02 * h &&
    reference.bottom <= 1.02 * h;
  const base = usable
    ? { x: reference.x, top: Math.max(0, reference.top), bottom: Math.min(h, reference.bottom) }
    : { x: 0.12 * w, top: 0.2 * h, bottom: 0.85 * h };
  const stick = { ...base, inches: REFERENCES[0].inches, ref: REFERENCES[0].id };
  return {
    stick,
    horizonY: clamp(horizonFromStick(stick), 0, stick.bottom - 8),
    focalPx: room.geometry?.focalPx ?? null,
    origin: "guess",
  };
}

// The layout model's scale when it has one, else the straighten fit's guess.
function autoCalibration(room) {
  return calibrationFromGeometry(room) ?? startCalibration(room);
}

async function measureLayout(src) {
  const photo = await (await fetch(src)).blob();
  const response = await fetch(`/api/layout?variant=${LAYOUT_VARIANT}`, { method: "POST", body: photo });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "The layout model failed on this photo.");
  const geometry = fromLayoutService(body);
  if (!geometry) throw new Error("The layout model sent nothing to size from.");
  return { geometry, raw: body };
}

function defaultLift(product) {
  return product.category === "tv" && /wall/i.test(product.name) ? 30 : 0;
}

// `initialAdd` holds product ids, or `{ id, x, y, yaw }` with `x` across the
// photo and `y` from the horizon (0) to the bottom edge (1). `quiet` leaves
// nothing selected after those first pieces go in. `compact` is the stage
// with Save the room under it. It and the pieces step put a trash can in the stage's bottom left
// corner and an add menu in its bottom right. The compact stage rises in no
// sooner than `enterAfter` ms into the page load. `wide` gives the photo the
// full width and drops each step's options from its button. Under that photo,
// saved rooms take the left half and the furniture list takes the right.
// `rooms` are the saved rooms the wide toolbar can resume.
export default function Studio({
  products: catalog,
  initialAdd,
  initialSrc = PRESETS.find((preset) => preset.slug === "kitchen").src,
  initialStraighten = null,
  initialScene = null,
  quiet = false,
  compact = false,
  wide = false,
  rooms = [],
  enterAfter = 0,
}) {
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const sourceRef = useRef(null);
  const uploadRef = useRef(null);
  const roomRef = useRef(null);
  const cutoutsRef = useRef(new Map());
  const addedRef = useRef(false);
  const keyRef = useRef(0);
  const clipboardRef = useRef(null);
  const focusRef = useRef(null);
  // Latest size while a key is held, so the next tap starts where the ease ended.
  const sizeLiveRef = useRef(null);
  const sizeHoldRef = useRef(null);

  const [step, setStep] = useState(initialAdd.length ? "pieces" : "photo");
  // Which step button's options are open. On the wide studio these drop from
  // the button instead of sitting in a card under the photo.
  const [stepMenu, setStepMenu] = useState(null);
  const stepMenuRef = useRef(null);
  const tools = compact || step === "pieces";
  const [src, setSrc] = useState(initialSrc);
  // Which catalog room this photo is. Example rooms are known; other photos
  // are guessed, and a pick in the furniture card holds until the photo changes.
  const [roomKind, setRoomKind] = useState(() => roomTypeForSrc(initialSrc));
  const [guessingRoom, setGuessingRoom] = useState(() => roomTypeForSrc(initialSrc) == null);
  const roomPickRef = useRef(false);
  const [fits, setFits] = useState(null);
  const [straighten, setStraighten] = useState(null);
  const [room, setRoom] = useState(null);
  const [calibration, setCalibration] = useState(null);
  const [layout, setLayout] = useState(null);
  const layoutsRef = useRef({});
  const rawLayoutsRef = useRef({});
  const [morph, setMorph] = useState(null);
  const [hoverGap, setHoverGap] = useState(null);
  const gapCanvasRef = useRef(null);
  const gapDrawings = useRef(new WeakMap());
  const [ranked, setRanked] = useState(null);
  const rankedRef = useRef(null);
  const [items, setItems] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [leaving, setLeaving] = useState(() => new Set());
  // The hero stage and its pieces wait, each piece with its delay, until the
  // stage scrolls into view.
  const entranceRef = useRef(null);
  const [entering, setEntering] = useState(() => new Map());
  const [entranceGo, setEntranceGo] = useState(false);
  const [stageIn, setStageIn] = useState(!compact);
  const trashRef = useRef(null);
  const placedRef = useRef([]);
  const [trashHot, setTrashHot] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [unlockOpen, setUnlockOpen] = useState(false);
  // Back from signing in to subscribe, or from checkout.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("unlock") && !url.searchParams.has("upgraded")) return;
    setUnlockOpen(true);
    url.searchParams.delete("unlock");
    url.searchParams.delete("upgraded");
    window.history.replaceState(null, "", url);
  }, []);
  const menuRef = useRef(null);
  const [cutouts, setCutouts] = useState({});
  // The catalog with each loaded photo's azimuth as fitted to its cutout.
  const products = useMemo(
    () =>
      catalog.map((product) => ({
        ...product,
        photos: product.photos.map((photo) =>
          cutouts[photo.path] ? { ...photo, azimuthDeg: fittedAzimuth(product, photo, cutouts[photo.path]) } : photo,
        ),
      })),
    [catalog, cutouts],
  );
  const [stageWidth, setStageWidth] = useState(0);
  const [snap, setSnap] = useState(true);
  const [turnWithView, setTurnWithView] = useState(false);
  const [warp, setWarp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveHint, setSaveHint] = useState(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [saved, setSaved] = useState(null);
  // The saved room being edited, so saving again replaces it.
  const [sceneId, setSceneId] = useState(initialScene?.id ?? null);
  const restoreRef = useRef(initialScene?.edit ? initialScene : null);
  const [account, setAccount] = useState(null);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setAccount)
      .catch(() => setAccount({ signedIn: false }));
  }, []);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setFits(null);
    setStraighten(null);
    setError(null);
    loadImage(src)
      .then((img) => {
        if (cancelled) return;
        sourceRef.current = img;
        let candidate = { ok: false };
        try {
          candidate = assessStraightenCandidate(img);
        } catch {
          candidate = { ok: false };
        }
        const nextFits = {
          wall: candidate.ok ? candidate.quad : null,
          verticals: candidate.ok && candidate.lines ? candidate.lines.flat() : null,
        };
        setFits(nextFits);
        const pick = initialStraighten ?? rankedRef.current?.option ?? DEFAULT_STRAIGHTEN;
        const fitted = pick === "upright" || pick === "none" || nextFits[pick];
        setStraighten(fitted ? pick : candidate.ok ? candidate.mode : "none");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    fetch("/api/votes/ranking")
      .then((r) => (r.ok ? r.json() : null))
      .then((ranking) => {
        const pick = bestSupported(ranking, RANKED_OPTIONS);
        rankedRef.current = pick;
        setRanked(pick);
        if (pick && !initialStraighten) setStraighten((current) => (current === DEFAULT_STRAIGHTEN ? pick.option : current));
      })
      .catch(() => {});
  }, []);

  const layoutReady = layout?.src === src && layout.status === "ready";
  const layoutFailed = layout?.src === src && layout.status === "error";
  const gapId = hoverGap?.id ?? 0;
  useEffect(() => {
    if (!gapId) return;
    const hide = () => setHoverGap(null);
    window.addEventListener("scroll", hide, { passive: true });
    return () => window.removeEventListener("scroll", hide);
  }, [gapId]);
  useEffect(() => {
    const canvas = gapCanvasRef.current;
    if (!canvas || !gapId || !room?.gaps) return;
    let drawn = gapDrawings.current.get(room.gaps);
    if (!drawn) gapDrawings.current.set(room.gaps, (drawn = {}));
    drawn[gapId] ||= drawGap(room.gaps, gapId, room.w / Math.max(1, stageWidth));
    canvas.width = room.w;
    canvas.height = room.h;
    canvas.getContext("2d").drawImage(drawn[gapId], 0, 0);
  }, [gapId, room, stageWidth]);

  // A new photo before its first render, or Upright waiting on the camera tilt.
  const straightening =
    Boolean(room) && (room.src !== src || (straighten === "upright" && room.mode === "none" && !layoutFailed));

  useEffect(() => {
    const img = sourceRef.current;
    if (!img || !fits || !straighten) return;
    let mode = straighten;
    let canvas = null;
    let badge = null;
    const raw = rawLayoutsRef.current[src];
    if (mode === "upright" && !raw) {
      // Shown as shot until the layout model answers; if it cannot, use the
      // on-device fit instead.
      if (!layoutFailed) mode = "none";
      else mode = fits.wall ? "wall" : fits.verticals ? "verticals" : "none";
    }
    try {
      if (mode === "upright") {
        const plan = uprightPlan(raw);
        canvas = plan.render(img);
        badge = plan.badge;
      }
      if (mode === "wall" && fits.wall) canvas = straightenQuad(img, fits.wall);
      if (mode === "verticals" && fits.verticals) {
        const v = fits.verticals;
        canvas = straightenVerticals(img, [
          [v[0], v[1]],
          [v[2], v[3]],
        ]);
      }
    } catch {
      canvas = null;
    }
    if (!canvas) {
      mode = "none";
      canvas = flatCanvas(img);
    }
    const info = mode === "none" ? null : warpInfo(canvas);
    const shrink = canvas.width / img.naturalWidth;
    const toOutput = info ? info.toOutput : (p) => ({ x: p.x * shrink, y: p.y * shrink });
    const known = layoutsRef.current[src];
    const natural = { w: img.naturalWidth, h: img.naturalHeight };
    const corners = [
      { x: 0, y: 0 },
      { x: natural.w, y: 0 },
      { x: natural.w, y: natural.h },
      { x: 0, y: natural.h },
    ].map(toOutput);
    const next = {
      src,
      natural,
      corners: corners.every(Boolean) ? corners.map((p) => ({ x: p.x / canvas.width, y: p.y / canvas.height })) : null,
      canvas,
      mask: info?.mask ?? null,
      gaps: gapRegions(info?.mask ?? null),
      w: canvas.width,
      h: canvas.height,
      mode,
      badge,
      toOutput,
      geometry: known ? geometryInRoom(known, toOutput) : null,
      reference: referenceStick(mode, fits[mode], info),
      url: null,
      maskUrl: null,
    };
    let cancelled = false;
    Promise.all([canvasBlob(canvas), next.mask ? canvasBlob(next.mask) : null]).then(async ([roomBlob, maskBlob]) => {
      if (cancelled) return;
      next.url = URL.createObjectURL(roomBlob);
      next.maskUrl = maskBlob ? URL.createObjectURL(maskBlob) : null;
      // Decoded before it is swapped in, so the stage never shows blank.
      const shown = new Image();
      shown.src = next.url;
      await shown.decode().catch(() => {});
      if (cancelled) {
        URL.revokeObjectURL(next.url);
        if (next.maskUrl) URL.revokeObjectURL(next.maskUrl);
        return;
      }
      const previous = roomRef.current;
      roomRef.current = next;
      if (previous) {
        URL.revokeObjectURL(previous.url);
        if (previous.maskUrl) URL.revokeObjectURL(previous.maskUrl);
        const sx = next.w / previous.w;
        const sy = next.h / previous.h;
        setItems((current) => current.map((item) => ({ ...item, x: item.x * sx, y: item.y * sy })));
      }
      setMorph(morphBetween(previous, next, img));
      setHoverGap(null);
      setRoom(next);
      setCalibration(autoCalibration(next));
      setSaved(null);
    });
    return () => {
      cancelled = true;
    };
    // `src` changes only reach here through `fits`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fits, straighten, straighten === "upright" && layoutReady, straighten === "upright" && layoutFailed]);

  useEffect(() => {
    if (!wide) return;
    roomPickRef.current = false;
    const known = roomTypeForSrc(src);
    if (known) {
      setRoomKind(known);
      setGuessingRoom(false);
      return;
    }
    let cancelled = false;
    setRoomKind(null);
    setGuessingRoom(true);
    (async () => {
      try {
        const img = await loadImage(src);
        const max = 512;
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
        if (!blob || cancelled || roomPickRef.current) return;
        const response = await fetch("/api/room-type", {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: blob,
        });
        const body = await response.json();
        if (!cancelled && !roomPickRef.current) setRoomKind(body.room ?? null);
      } catch {
        if (!cancelled && !roomPickRef.current) setRoomKind(null);
      } finally {
        if (!cancelled) setGuessingRoom(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src, wide]);

  useEffect(() => {
    if (layoutsRef.current[src]) {
      setLayout({ status: "ready", src });
      return;
    }
    let cancelled = false;
    setLayout({ status: "loading", src });
    measureLayout(src)
      .then(({ geometry, raw }) => {
        layoutsRef.current[src] = geometry;
        rawLayoutsRef.current[src] = raw;
        if (cancelled) return;
        setLayout({ status: "ready", src });
        const current = roomRef.current;
        if (!current || current.src !== src) return;
        const updated = { ...current, geometry: geometryInRoom(geometry, current.toOutput) };
        roomRef.current = updated;
        setRoom(updated);
        setCalibration((c) => (c?.origin === "hand" ? { ...c, focalPx: updated.geometry.focalPx ?? c.focalPx } : autoCalibration(updated)));
      })
      .catch((err) => {
        if (!cancelled) setLayout({ status: "error", src, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(
    () => () => {
      const current = roomRef.current;
      if (current?.url) URL.revokeObjectURL(current.url);
      if (current?.maskUrl) URL.revokeObjectURL(current.maskUrl);
      if (uploadRef.current) URL.revokeObjectURL(uploadRef.current);
    },
    [],
  );

  useEffect(() => {
    const photos = items.flatMap((item) => catalog.find((p) => p.id === item.productId)?.photos ?? []);
    for (const photo of photos) {
      if (cutoutsRef.current.has(photo.path)) continue;
      cutoutsRef.current.set(photo.path, null);
      loadImage(photo.path)
        .then((img) => {
          const content = opaqueBox(img);
          cutoutsRef.current.set(photo.path, { img, content });
          setCutouts((current) => ({ ...current, [photo.path]: content }));
        })
        .catch(() => cutoutsRef.current.delete(photo.path));
    }
  }, [items, catalog]);

  useEffect(() => {
    // Wait for the layout model's scale too, so the pieces do not jump when it lands.
    const layoutPending = layout?.src !== src || layout.status === "loading";
    if (addedRef.current || !room || !calibration || straightening || layoutPending) return;
    addedRef.current = true;
    const delays = new Map();
    for (const entry of initialAdd) {
      const at = typeof entry === "number" ? { id: entry } : entry;
      const product = products.find((p) => p.id === at.id);
      const key = product && addPiece(product, at);
      if (key) delays.set(key, ENTER_AFTER_MS + delays.size * ENTER_STAGGER_MS);
    }
    if (compact) setEntering(delays);
    if (quiet) {
      focusRef.current = null;
      setSelectedKey(null);
    }
    // Only the first room takes the pieces from the link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, calibration, straightening, layout]);

  // A reopened room gets its pieces and hand-set scale back once its photo is
  // straightened the way it was saved.
  useEffect(() => {
    const scene = restoreRef.current;
    const layoutPending = layout?.src !== src || layout.status === "loading";
    if (!scene || !room || !calibration || straightening || layoutPending || room.src !== src) return;
    restoreRef.current = null;
    const sx = room.w / scene.room.width;
    const sy = room.h / scene.room.height;
    const same = Math.abs(sx - 1) < 0.002 && Math.abs(sy - 1) < 0.002;
    if (same && scene.edit.calibration) setCalibration(scene.edit.calibration);
    const restored = (scene.edit.items ?? []).map((item) => ({ ...item, x: item.x * sx, y: item.y * sy }));
    keyRef.current = Math.max(keyRef.current, ...restored.map((item) => Number(String(item.key).replace(/\D/g, "")) + 1 || 0));
    sizeLiveRef.current = null;
    setItems(restored);
    setSelectedKey(null);
    setStep("pieces");
  }, [room, calibration, straightening, layout, src]);

  function addPiece(product, at = {}) {
    const current = roomRef.current;
    if (!current || !calibration) return;
    const n = keyRef.current++;
    const floor = current.h - calibration.horizonY;
    const item = {
      key: `piece-${n}`,
      productId: product.id,
      yaw: 0,
      altitude: null,
      x: current.w * (at.x ?? 0.3 + 0.4 * ((n * 0.37) % 1)),
      y: calibration.horizonY + floor * (at.y ?? (product.category === "rug" ? 0.75 : 0.55)),
      liftIn: defaultLift(product),
      scale: 1,
      flip: false,
    };
    // A new piece shows its front. Snapping may move it to a wall, but does not turn it.
    const dropped = at.x == null && at.y == null && at.yaw == null;
    if (snap && product.category !== "rug" && dropped) {
      const snapped = snapToWall(calibration, current.w, walls, item, product);
      if (snapped) {
        item.x = snapped.x;
        item.y = snapped.y;
      }
    }
    item.yaw = at.yaw ?? (product.category === "rug" ? 0 : yawForView(calibration, item, current.w, 0));
    focusRef.current = item.key;
    setItems((list) => [...list, item]);
    setSelectedKey(item.key);
    setSaved(null);
    return item.key;
  }

  useEffect(() => {
    const stage = entranceRef.current;
    if (!compact || entranceGo || !stage || !(entering.size || error)) return;
    let timer = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        timer = window.setTimeout(() => setEntranceGo(true), Math.max(0, enterAfter - performance.now()));
      },
      { threshold: 0.35 },
    );
    observer.observe(stage);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [entering, entranceGo, error]);

  useEffect(() => {
    function onKey(event) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key !== "c" && key !== "v") return;
      const target = event.target;
      if (target?.closest?.("input, textarea, select, [contenteditable=true]")) return;
      if (window.getSelection()?.toString()) return;
      if (key === "c") {
        const item = items.find((i) => i.key === selectedKey);
        if (!item) return;
        event.preventDefault();
        clipboardRef.current = item;
        return;
      }
      const copied = clipboardRef.current;
      if (!copied || !room || !calibration) return;
      event.preventDefault();
      const pasted = {
        ...copied,
        key: `piece-${keyRef.current++}`,
        x: clamp(copied.x + room.w * 0.04, 0, room.w),
        y: clamp(copied.y + room.h * 0.02, calibration.horizonY + 4, lowestFor(copied)),
      };
      clipboardRef.current = pasted;
      focusRef.current = pasted.key;
      setItems((list) => [...list, pasted]);
      setSelectedKey(pasted.key);
      setStep("pieces");
      setSaved(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selectedKey, room, calibration]);

  useEffect(() => () => stopSizeHold(), []);

  const hasStage = Boolean(room?.url && calibration);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => setStageWidth(stage.clientWidth));
    observer.observe(stage);
    setStageWidth(stage.clientWidth);
    return () => observer.disconnect();
  }, [hasStage]);

  useEffect(() => {
    const key = focusRef.current;
    if (!key) return;
    const button = stageRef.current?.querySelector(`[data-piece="${key}"]`);
    if (!button) return;
    focusRef.current = null;
    button.focus({ preventScroll: true });
  });

  function lowestFor(item) {
    const product = products.find((p) => p.id === item.productId);
    return product ? lowestRow(calibration, room.w, product, item.scale, room.h * 1.3) : room.h * 1.3;
  }

  function updateItem(key, patch) {
    if (patch.scale != null) sizeLiveRef.current = { key, scale: patch.scale };
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));
    setSaved(null);
  }

  // `commit` turns a short press into one chunk. A press that already started
  // easing just stops where it is.
  function stopSizeHold(commit) {
    const hold = sizeHoldRef.current;
    if (!hold) return null;
    sizeHoldRef.current = null;
    window.clearTimeout(hold.timer);
    if (hold.frame) cancelAnimationFrame(hold.frame);
    window.removeEventListener("keyup", hold.onKeyUp);
    window.removeEventListener("blur", hold.stop);
    if (commit && !hold.gliding) {
      const jumped = Math.round(clampSize(hold.scale + hold.direction * SIZE_CHUNK) * 100) / 100;
      updateItem(hold.key, { scale: jumped });
    }
    return hold;
  }

  // A tap jumps by a chunk when the key comes up. Holding past the delay
  // eases the size instead, so it can be stopped between the chunk marks.
  function beginSizeHold(key, direction, scale) {
    const previous = stopSizeHold(false);
    const remembered = sizeLiveRef.current?.key === key ? sizeLiveRef.current.scale : scale;
    const from = previous?.key === key ? previous.scale : remembered;
    const hold = { key, direction, scale: from, arrow: direction > 0 ? "ArrowUp" : "ArrowDown", gliding: false, frame: 0, timer: 0 };
    hold.stop = () => stopSizeHold(true);
    hold.onKeyUp = (event) => {
      const modifier = event.key === "Shift" || event.key === "Meta" || event.key === "Control";
      if (event.key !== hold.arrow && !modifier) return;
      if (modifier && (event.shiftKey || event.metaKey || event.ctrlKey)) return;
      stopSizeHold(true);
    };
    hold.timer = window.setTimeout(() => {
      if (sizeHoldRef.current !== hold) return;
      hold.gliding = true;
      hold.last = performance.now();
      const tick = (now) => {
        if (sizeHoldRef.current !== hold) return;
        const dt = Math.min(0.05, (now - hold.last) / 1000);
        hold.last = now;
        const next = clampSize(hold.scale + direction * SIZE_HOLD_PER_SEC * dt);
        hold.scale = next;
        updateItem(key, { scale: next });
        if (next === SIZE_MIN || next === SIZE_MAX) {
          stopSizeHold(false);
          return;
        }
        hold.frame = requestAnimationFrame(tick);
      };
      hold.frame = requestAnimationFrame(tick);
    }, SIZE_HOLD_DELAY_MS);
    sizeHoldRef.current = hold;
    window.addEventListener("keyup", hold.onKeyUp);
    window.addEventListener("blur", hold.stop);
  }

  // Fades the piece out first; it leaves the scene when the fade ends.
  function removeItem(key) {
    setLeaving((current) => new Set(current).add(key));
    setSelectedKey((current) => (current === key ? null : current));
    setSaved(null);
    window.setTimeout(() => {
      setItems((list) => list.filter((item) => item.key !== key));
      setLeaving((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }, LEAVE_MS);
  }

  const placedCounts = useMemo(() => {
    const counts = new Map();
    for (const item of items) counts.set(item.productId, (counts.get(item.productId) ?? 0) + 1);
    return counts;
  }, [items]);

  const menuMatches = useMemo(() => {
    const words = menuQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return products.filter((product) => {
      const text = `${product.name} ${product.category} ${product.room} ${product.sellerName}`.toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [products, menuQuery]);

  function addFromMenu(product) {
    addPiece(product);
    setMenuOpen(false);
  }

  function placeFromList(product) {
    addPiece(product);
    setStep("pieces");
    setStepMenu(null);
  }

  useEffect(() => {
    if (!menuOpen) {
      setMenuQuery("");
      return;
    }
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const escape = (event) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!stepMenu) return;
    const close = (event) => {
      if (!stepMenuRef.current?.contains(event.target)) setStepMenu(null);
    };
    const escape = (event) => event.key === "Escape" && setStepMenu(null);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [stepMenu]);

  function overTrash(event) {
    const rect = trashRef.current?.getBoundingClientRect();
    return Boolean(rect) && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  }

  function onFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (uploadRef.current) URL.revokeObjectURL(uploadRef.current);
    const url = URL.createObjectURL(file);
    uploadRef.current = url;
    setSrc(url);
    setSceneId(null);
    setStep("pieces");
    setStepMenu(null);
  }

  function roomPoint(event) {
    const rect = stageRef.current.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * room.w,
      y: ((event.clientY - rect.top) / rect.height) * room.h,
    };
  }

  // The front-most piece with paint under `p`. A click in a piece's see-through
  // gaps falls back to the smallest box there, so nearby small pieces win.
  function pieceAt(p) {
    const slack = (HIT_SLACK * room.w) / Math.max(1, stageWidth);
    const probes = [
      [0, 0],
      [slack, 0],
      [-slack, 0],
      [0, slack],
      [0, -slack],
    ];
    let fallback = null;
    for (let i = placed.length - 1; i >= 0; i--) {
      const { item, content, box, rug, faces } = placed[i];
      if (leaving.has(item.key)) continue;
      if (p.x < box.x - slack || p.x > box.x + box.width + slack || p.y < box.y - slack || p.y > box.y + box.height + slack) {
        continue;
      }
      for (const [dx, dy] of probes) {
        for (const face of faces) {
          const s = applyHomography(face.back, p.x + dx, p.y + dy);
          if (insideQuad(face.region, s) && opaqueAt(content, s.x, s.y)) return item.key;
        }
      }
      const inside = p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height;
      if (!rug && inside && (!fallback || box.width * box.height < fallback.area)) {
        fallback = { key: item.key, area: box.width * box.height };
      }
    }
    return fallback?.key ?? null;
  }

  function onStageDown(event) {
    if (!room || !calibration) return;
    const key = pieceAt(roomPoint(event));
    if (key) startDrag(event, { kind: "item", key });
    else setSelectedKey(null);
  }

  function onStageMove(event) {
    if (dragRef.current) {
      if (tools && dragRef.current.kind === "item") {
        setTrashHot(overTrash(event));
        // Off the floor, on the way to the trash, the piece stays where it was.
        const rect = stageRef.current.getBoundingClientRect();
        const off = event.clientX < rect.left || event.clientX > rect.right || event.clientY > rect.bottom;
        if (off) return;
      }
      onDrag(event);
      return;
    }
    if (event.pointerType !== "mouse" || !room || !calibration) return;
    const p = roomPoint(event);
    const onPiece = Boolean(pieceAt(p));
    event.currentTarget.style.cursor = onPiece ? "grab" : "";
    const id = onPiece ? 0 : gapAt(room.gaps, p);
    setHoverGap(id ? { id, x: event.clientX, y: event.clientY } : null);
  }

  function startDrag(event, drag) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = roomPoint(event);
    if (drag.kind === "item") {
      const item = items.find((i) => i.key === drag.key);
      drag.dx = item.x - p.x;
      drag.dy = item.y - p.y;
      drag.view = viewAzimuth(calibration, item, room.w);
      drag.altitude = item.altitude ?? placedRef.current.find((entry) => entry.item.key === item.key)?.photo?.altitudeDeg ?? null;
      stageRef.current?.querySelector(`[data-piece="${drag.key}"]`)?.focus({ preventScroll: true });
      setSelectedKey(drag.key);
      setStep("pieces");
    }
    dragRef.current = drag;
  }

  function onDrag(event) {
    const drag = dragRef.current;
    if (!drag || !room || !calibration) return;
    const p = roomPoint(event);
    const { stick, horizonY } = calibration;
    if (drag.kind === "item") {
      const item = items.find((i) => i.key === drag.key);
      const product = item && products.find((pr) => pr.id === item.productId);
      if (!item || !product) return;
      const moved = {
        x: clamp(p.x + drag.dx, 0, room.w),
        y: clamp(p.y + drag.dy, horizonY + 4, lowestFor(item)),
      };
      let snapped =
        snap && !event.altKey && product.category !== "rug"
          ? snapToWall(calibration, room.w, walls, { ...item, ...moved }, product)
          : null;
      // The wall may turn a piece and move it, but it keeps the camera height it
      // was already showing. Auto would otherwise pick a new height at the wall.
      // Keep the camera height from when the piece was picked up. The wall may
      // turn it and move it, but that must not pick a different altitude.
      if (snapped && item.altitude == null && drag.altitude != null) snapped = { ...snapped, altitude: drag.altitude };
      // Unless turning with the view is on, a piece keeps the side it is showing.
      // Snapping adopts the wall's side, and that side stays when it leaves the wall.
      if (!turnWithView && product.category !== "rug") {
        if (snapped) drag.view = viewAzimuth(calibration, { ...item, ...snapped }, room.w);
        else if (drag.view != null) moved.yaw = yawForView(calibration, { ...item, ...moved }, room.w, drag.view);
      }
      updateItem(drag.key, snapped ?? moved);
      return;
    }
    setSaved(null);
    const byHand = { ...calibration, origin: "hand" };
    if (drag.kind === "horizon") {
      setCalibration({ ...byHand, horizonY: clamp(p.y, 0, stick.bottom - 8) });
    } else if (drag.kind === "stickTop") {
      setCalibration({ ...byHand, stick: { ...stick, top: clamp(p.y, 0, stick.bottom - 8) } });
    } else if (drag.kind === "stickBottom") {
      setCalibration({
        ...byHand,
        stick: { ...stick, x: clamp(p.x, 0, room.w), bottom: clamp(p.y, Math.max(stick.top, horizonY) + 8, room.h) },
      });
    }
  }

  function endDrag(event) {
    const drag = dragRef.current;
    dragRef.current = null;
    setTrashHot(false);
    if (drag?.kind === "item" && event && overTrash(event)) removeItem(drag.key);
  }

  function onItemKey(event, item) {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeItem(item.key);
      return;
    }
    const resize = (event.shiftKey || event.metaKey || event.ctrlKey) && !event.altKey ? { ArrowUp: 1, ArrowDown: -1 }[event.key] : 0;
    if (resize) {
      event.preventDefault();
      if (!event.repeat) beginSizeHold(item.key, resize, item.scale ?? 1);
      return;
    }
    if (!event.shiftKey) {
      const turn = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      const tilt = { ArrowUp: 1, ArrowDown: -1 }[event.key];
      if (!turn && !tilt) return;
      event.preventDefault();
      const entry = placed.find((e) => e.item.key === item.key);
      if (!entry) return;
      if (entry.rug) {
        if (turn) updateItem(item.key, { yaw: (((item.yaw + turn * RUG_TURN_DEG) % 360) + 360) % 360 });
        else updateItem(item.key, { altitude: tiltRug(item.altitude ?? entry.autoAltitude, tilt) });
        return;
      }
      const sign = item.flip ? -1 : 1;
      if (turn && event.altKey) {
        updateItem(item.key, { yaw: wrapDeg(item.yaw + turn * FINE_TURN_DEG) });
      } else if (turn) {
        const azimuth = turnAzimuth(entry.product, sign * entry.viewAzimuth, sign * turn, entry.photo.altitudeDeg);
        if (azimuth != null) updateItem(item.key, { yaw: yawForView(calibration, item, room.w, sign * azimuth) });
      } else {
        const shot = tiltAltitude(entry.product, entry.photo, tilt);
        if (shot) updateItem(item.key, { altitude: shot.altitudeDeg, yaw: yawForView(calibration, item, room.w, sign * shot.azimuthDeg) });
      }
      return;
    }
    const step = 10;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!move) return;
    event.preventDefault();
    const next = {
      x: clamp(item.x + move[0], 0, room.w),
      y: clamp(item.y + move[1], calibration.horizonY + 4, lowestFor(item)),
    };
    const nudged = placed.find((e) => e.item.key === item.key);
    // Same rule as dragging: the side it shows stays put unless that option is on.
    if (nudged && !nudged.rug && !turnWithView) {
      next.yaw = yawForView(calibration, { ...item, ...next }, room.w, nudged.viewAzimuth);
    }
    updateItem(item.key, next);
  }

  function setReference(id) {
    const ref = REFERENCES.find((r) => r.id === id);
    setCalibration((c) => ({ ...c, origin: "hand", stick: { ...c.stick, ref: id, inches: ref ? ref.inches : c.stick.inches } }));
    setSaved(null);
  }

  // Back to front: rugs lie under everything, then whatever stands farther back.
  const placed = room && calibration
    ? items
        .map((item) => {
          const product = products.find((p) => p.id === item.productId);
          if (!product) return { box: null };
          const autoAltitude = viewAltitude(calibration, item, product, room.w);
          if (product.category === "rug") {
            const photo = rugPhoto(product);
            const content = photo ? cutouts[photo.path] : null;
            const box = content?.corners ? placementBox(calibration, item, product, room.w) : null;
            const corners = box && rugCorners(content, item.flip);
            const H = corners && quadHomography(corners, box.quad);
            const back = H && invertHomography(H);
            if (!back) return { box: null };
            const faces = [{ id: "floor", photo: corners, room: box.quad, region: corners, H, back }];
            return { item, product, photo, content, box, faces, autoAltitude, rug: true };
          }
          const seen = viewAzimuth(calibration, item, room.w);
          // A flipped piece is its mirror twin, drawn from the mirrored view.
          // A locked height only considers shots from that height, so backing
          // it against a wall cannot swap in a flatter or steeper photo.
          const altitude = item.altitude ?? autoAltitude;
          const wanted = photoFor(product, shownAzimuth(product, item.flip ? -seen : seen, item.altitude == null ? null : altitude), altitude);
          const photo = wanted && cutouts[wanted.path] ? wanted : product.photos.find((p) => cutouts[p.path]);
          const content = photo ? cutouts[photo.path] : null;
          const drawn = content ? standingFaces(calibration, item, product, photo, content, room.w, warp) : null;
          if (!drawn) return { box: null };
          const drawnPts = drawn.faces.flatMap((face) => face.region.map((p) => applyHomography(face.H, p.x, p.y)));
          const box = { ...boundsOf(drawnPts), pxPerInch: pxPerInch(calibration, item.y) };
          return { item, product, photo, content, box, faces: drawn.faces, corners: drawn.corners, viewAzimuth: seen, autoAltitude };
        })
        .filter((entry) => entry.box)
        .sort((a, b) => {
          const rugA = a.product.category === "rug" ? 0 : 1;
          const rugB = b.product.category === "rug" ? 0 : 1;
          return rugA - rugB || a.item.y - b.item.y;
        })
    : [];
  const walls = room?.geometry?.floor && calibration ? wallPoints(calibration, room.w, room.geometry.floor) : [];
  placedRef.current = placed;

  async function save() {
    if (saving) return;
    setSaveHint(null);
    if (!room || !calibration) {
      setSaveHint("The photo is still opening.");
      return;
    }
    if (!placed.length) {
      setSaveHint("Place a piece on the floor, then save the room.");
      return;
    }
    setSaving(true);
    setError(null);
    setNeedsSignIn(false);
    try {
      const mockup = document.createElement("canvas");
      mockup.width = room.w;
      mockup.height = room.h;
      const ctx = mockup.getContext("2d");
      ctx.drawImage(room.canvas, 0, 0);
      for (const { photo, faces } of placed) {
        const cut = cutoutsRef.current.get(photo.path);
        if (!cut) continue;
        for (const face of faces) paintMapped(ctx, cut.img, face.H, face.region, true);
      }
      const round = (v) => Math.round(v * 10) / 10;
      const scene = {
        version: 2,
        source: src.startsWith("blob:") ? "upload" : src,
        straighten: room.mode,
        room: { width: room.w, height: room.h },
        calibration: {
          horizonY: round(calibration.horizonY),
          cameraIn: round(cameraFromStick(calibration.stick, calibration.horizonY) ?? 0),
          stick: { ...calibration.stick, x: round(calibration.stick.x), top: round(calibration.stick.top), bottom: round(calibration.stick.bottom) },
          focalPx: calibration.focalPx ? round(calibration.focalPx) : null,
          origin: calibration.origin,
          layoutSource: room.geometry?.source ?? null,
        },
        items: placed.map(({ item, product, photo, box, corners, viewAzimuth: seen, autoAltitude, rug }) => ({
          productId: product.id,
          name: product.name,
          category: product.category,
          sellerName: product.sellerName,
          sellerUrl: product.sellerUrl,
          inches: { width: product.widthIn, height: product.heightIn, depth: product.depthIn },
          angle: rug ? "laid on the floor" : photo.angle,
          yawDeg: round(item.yaw),
          azimuthDeg: rug ? round(item.yaw) : photo.azimuthDeg,
          ...(rug ? {} : { viewAzimuthDeg: round(seen) }),
          altitudeDeg: rug ? round(item.altitude ?? autoAltitude) : photo.altitudeDeg,
          cameraAltitudeDeg: round(autoAltitude),
          altitudeAuto: item.altitude == null,
          floorCorners: (rug ? box.quad : corners.slice(0, 4)).map((p) => ({ x: round(p.x), y: round(p.y) })),
          ...(rug ? {} : { topCorners: corners.slice(4).map((p) => ({ x: round(p.x), y: round(p.y) })) }),
          photo: photo.path,
          flip: item.flip,
          liftIn: item.liftIn,
          sizeFix: item.scale,
          floorPoint: { x: round(item.x), y: round(item.y) },
          box: { x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) },
          pxPerInch: round(box.pxPerInch * 100) / 100,
        })),
        edit: { calibration, items },
      };
      const form = new FormData();
      form.set("scene", JSON.stringify(scene));
      form.set("room", await canvasBlob(room.canvas), "room.png");
      form.set("mockup", await canvasBlob(mockup), "mockup.png");
      if (room.mask) form.set("mask", await canvasBlob(room.mask), "mask.png");
      const source = await fetch(src).then((r) => r.blob()).catch(() => null);
      if (source) form.set("source", source, "source");
      if (sceneId) form.set("id", sceneId);
      const response = await fetch("/api/scenes", { method: "POST", body: form });
      const body = await response.json();
      if (response.status === 401) {
        setAccount({ signedIn: false });
        setNeedsSignIn(true);
        return;
      }
      if (response.status === 402) setUnlockOpen(true);
      if (!response.ok) throw new Error(body.error || "The room did not save.");
      setSaved(body.id);
      setSceneId(body.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const selected = items.find((item) => item.key === selectedKey) ?? null;
  const selectedProduct = selected ? products.find((p) => p.id === selected.productId) : null;
  const selectedK = selected && calibration ? pxPerInch(calibration, selected.y) : 0;
  const selectedEntry = selected ? placed.find((entry) => entry.item.key === selected.key) : null;
  const cameraIn = calibration ? cameraFromStick(calibration.stick, calibration.horizonY) : null;
  const layoutHere = layout?.src === src ? layout : null;
  const scaleNote =
    calibration?.origin === "model"
      ? `Set from the room by ${room?.geometry?.source}: floor and ceiling lines, eye level${room?.geometry?.focalPx ? ", and lens" : ""}. The stick assumes an 8 ft ceiling.`
      : calibration?.origin === "hand"
        ? "Set by hand. Reset goes back to the automatic scale."
        : layoutHere?.status === "loading"
          ? "A guess from the straighten fit while the layout model looks at the room…"
          : layoutHere?.status === "error"
            ? `A guess from the straighten fit. ${layoutHere.error}`
            : "A guess from the straighten fit. The layout model found no floor and ceiling to size from.";
  const pct = (v, total) => `${(v / total) * 100}%`;

  const cornerButton = `${press} h-11 w-11 border-[3px] p-0 sm:h-14 sm:w-14`;

  const photoPanel = (
            <section className={panel}>
              <h2 className="m-0 font-display text-xl tracking-[0.02em]">Photo</h2>
              <label className={`${press} mt-3 border-[3px] bg-hot px-5 py-2 font-display text-lg text-white`}>
                Choose a photo
                <input className="sr-only" type="file" accept="image/*" onChange={onFile} />
              </label>
              <p className="mt-4 mb-0 font-mono text-[12px] text-ink/70">Or try a room from 326 Wyandotte Ave</p>
              <ul className="m-0 mt-2 grid list-none grid-cols-3 gap-2 p-0">
                {PRESETS.filter((preset) => !["bedroom", "bedroom-2", "bedroom-3", "bath", "laundry"].includes(preset.slug)).map((preset) => (
                  <li key={preset.slug}>
                    <button
                      type="button"
                      className={`block w-full cursor-pointer overflow-hidden rounded-xl border-[3px] border-ink bg-white p-0 text-left ${
                        src === preset.src ? "outline-[3px] outline-offset-2 outline-hot" : "shadow-[3px_3px_0_0_#1a1a1a]"
                      }`}
                      aria-pressed={src === preset.src}
                      onClick={() => {
                        setSrc(preset.src);
                        setSceneId(null);
                      }}
                    >
                      <img className="block aspect-[4/3] w-full object-cover" src={preset.thumb} alt="" loading="lazy" />
                      <span className="block truncate border-t-2 border-ink px-1.5 py-0.5 font-mono text-[10px] font-bold">
                        {preset.label}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
  );

  const straightenPanel = (
          <section className={panel}>
            <h2 className="m-0 font-display text-xl tracking-[0.02em]">Straighten</h2>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Straighten mode">
              {STRAIGHTEN.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={chip(straighten === option.id)}
                  aria-pressed={straighten === option.id}
                  disabled={
                    !fits ||
                    (option.id === "upright" ? layoutFailed : option.id !== "none" && !fits[option.id])
                  }
                  onClick={() => setStraighten(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {room?.badge ? (
              <p className="mt-3 mb-0 rounded-xl border-2 border-ink bg-blush px-3 py-2 font-mono text-[12px] font-bold leading-snug" role="status">
                {room.badge}
              </p>
            ) : null}
            {straighten === "upright" && room?.mode === "none" && !layoutFailed ? (
              <p className="mt-3 mb-0 font-mono text-[12px] text-ink/60">Asking the layout model for the camera tilt…</p>
            ) : null}
            <p className="mt-3 mb-0 text-xs leading-relaxed text-ink/60">
              {ranked
                ? `Starts on ${ranked.row.label}, the method leading the straighten votes (${Math.round(ranked.row.chance * 100)}% chance it is best). `
                : "Starts on Upright, the method that led the straighten votes. "}
              Sizes are only true once the verticals stand upright. Changing it puts the stick and eye level back to their automatic places.
            </p>
            <h2 className="mt-5 mb-0 border-t-2 border-ink/15 pt-4 font-display text-xl tracking-[0.02em]">Scale</h2>
            <p className="mt-2 mb-0 text-xs leading-relaxed text-ink/60">
              Stand the yellow stick on the floor against something you know, and set the dashed line at the camera's eye level.
            </p>
            {calibration ? (
              <>
                <p className="mt-3 mb-0 rounded-xl border-2 border-ink bg-cream px-2.5 py-1.5 font-mono text-[11px] leading-relaxed" role="status">
                  {scaleNote}
                </p>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Height reference">
                  {REFERENCES.map((ref) => (
                    <button
                      key={ref.id}
                      type="button"
                      className={chip(calibration.stick.ref === ref.id)}
                      aria-pressed={calibration.stick.ref === ref.id}
                      onClick={() => setReference(ref.id)}
                    >
                      {ref.label}
                    </button>
                  ))}
                </div>
                <label className="mt-3 flex items-center gap-2 font-mono text-[12px] font-bold">
                  Stick height
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    className="w-20 rounded-lg border-2 border-ink px-2 py-0.5"
                    value={calibration.stick.inches}
                    onChange={(event) => {
                      const inches = Number(event.target.value);
                      if (!(inches > 0)) return;
                      setCalibration((c) => ({ ...c, origin: "hand", stick: { ...c.stick, inches, ref: "custom" } }));
                      setSaved(null);
                    }}
                  />
                  in
                </label>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] text-ink/70">
                    Camera {cameraIn ? `${Math.round(cameraIn)} in up` : "unknown"}
                    {cameraIn && (cameraIn < 30 || cameraIn > 84) ? " · check the stick" : ""}
                  </span>
                  <button type="button" className={chip(false)} onClick={() => room && setCalibration(autoCalibration(room))}>
                    Reset
                  </button>
                </div>
              </>
            ) : null}
          </section>
  );

  const piecesPanel = (
    <div className="flex flex-col gap-3">
          <section className={panel}>
            <h2 className="m-0 font-display text-xl tracking-[0.02em]">Pieces</h2>
            <p className="mt-1 mb-0 font-mono text-[11px] text-ink/60">
              Add one with the + in the photo&apos;s corner. Drag one onto the trash to remove it.
            </p>
            <label className="mt-2 flex items-center gap-2 font-mono text-[12px] font-bold">
              <input type="checkbox" checked={snap && walls.length > 0} disabled={!walls.length} onChange={(event) => setSnap(event.target.checked)} />
              Back pieces against walls
            </label>
            <label className="mt-2 flex items-center gap-2 font-mono text-[12px] font-bold">
              <input type="checkbox" checked={turnWithView} onChange={(event) => setTurnWithView(event.target.checked)} />
              Turn pieces with the view as they move
            </label>
            <label className="mt-2 flex items-center gap-2 font-mono text-[12px] font-bold">
              <input type="checkbox" checked={warp} onChange={(event) => setWarp(event.target.checked)} />
              Perspective warp
            </label>
            <p className="mt-1 mb-0 font-mono text-[11px] text-ink/60">
              {walls.length
                ? "Drag a piece near a wall and it turns to sit flat against it. Pull it away and it keeps that side. Hold Alt while dragging to place it freely. In the open it keeps the side it was showing, unless Turn pieces with the view is on."
                : "No floor line from the layout model yet, so pieces stay where you drop them. A piece keeps the side it was showing unless Turn pieces with the view is on."}
            </p>
          </section>

      {selected && selectedProduct ? (
          <section className={`${panel} order-first bg-blush`}>
            <h2 className="m-0 font-display text-xl leading-tight tracking-[0.02em]">{selectedProduct.name}</h2>
            <p className="mt-1 mb-0 font-mono text-[12px] text-ink/70">
              {selectedProduct.widthIn}″ W × {selectedProduct.heightIn}″ H × {selectedProduct.depthIn}″ D
              {selectedK ? ` · ${Math.round(selectedK * 12)} px per foot here` : ""}
            </p>
            {selectedProduct.category === "rug" ? (
              <>
                <p className="mt-3 mb-0 font-mono text-[11px] leading-relaxed text-ink/60">
                  Left and right turn it on the floor. Up and down tilt it steeper or flatter. Shift with left or right moves it.
                  Shift, Command, or Control with up or down changes its size: a tap jumps, holding eases it slowly. Command or Control C and V copy it.
                </p>
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Turn on the floor">
                  {[0, 45, 90, 135].map((azimuth) => (
                    <button
                      key={azimuth}
                      type="button"
                      className={chip(turnDelta(selected.yaw, azimuth) < 1 || turnDelta(selected.yaw, azimuth + 180) < 1)}
                      aria-pressed={turnDelta(selected.yaw, azimuth) < 1}
                      onClick={() => updateItem(selected.key, { yaw: azimuth })}
                    >
                      {azimuth}°
                    </button>
                  ))}
                  <button
                    type="button"
                    className={chip(selected.flip)}
                    aria-pressed={selected.flip}
                    onClick={() => updateItem(selected.key, { flip: !selected.flip })}
                  >
                    Flip
                  </button>
                </div>
                {selectedEntry ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Tilt">
                    <button
                      type="button"
                      className={chip(selected.altitude == null)}
                      aria-pressed={selected.altitude == null}
                      onClick={() => updateItem(selected.key, { altitude: null })}
                    >
                      Auto · {Math.round(selectedEntry.autoAltitude)}°
                    </button>
                    <button
                      type="button"
                      className={chip(false)}
                      aria-label="Flatter"
                      disabled={(selected.altitude ?? selectedEntry.autoAltitude) <= RUG_TILT_DEG.min}
                      onClick={() => updateItem(selected.key, { altitude: tiltRug(selected.altitude ?? selectedEntry.autoAltitude, -1) })}
                    >
                      −
                    </button>
                    <span className="font-mono text-[12px] font-bold">{Math.round(selected.altitude ?? selectedEntry.autoAltitude)}°</span>
                    <button
                      type="button"
                      className={chip(false)}
                      aria-label="Steeper"
                      disabled={(selected.altitude ?? selectedEntry.autoAltitude) >= RUG_TILT_DEG.max}
                      onClick={() => updateItem(selected.key, { altitude: tiltRug(selected.altitude ?? selectedEntry.autoAltitude, 1) })}
                    >
                      +
                    </button>
                  </div>
                ) : null}
                <p className="mt-2 mb-0 font-mono text-[11px] text-ink/60">
                  Turned {Math.round(selected.yaw)}° on the floor, seen from {Math.round(selected.altitude ?? selectedEntry?.autoAltitude ?? 0)}° up
                  {selected.altitude == null ? ", as the room puts it" : ""}
                </p>
              </>
            ) : (
              <>
            <p className="mt-3 mb-0 font-mono text-[11px] text-ink/60">
              Left and right turn it to the next view, Alt with them a little. Up and down tilt the view. Shift with left or
              right moves it. Shift, Command, or Control with up or down changes its size: a tap jumps, holding eases it slowly. Command or Control C and V copy it.
            </p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="View">
              {azimuthsOf(selectedProduct, selectedEntry?.photo.altitudeDeg).map((azimuth) => {
                const shot = photoFor(selectedProduct, azimuth, selectedEntry?.photo.altitudeDeg ?? 0);
                return (
                  <button
                    key={azimuth}
                    type="button"
                    className={chip(selectedEntry?.photo.azimuthDeg === azimuth)}
                    aria-pressed={selectedEntry?.photo.azimuthDeg === azimuth}
                    onClick={() =>
                      updateItem(selected.key, { yaw: yawForView(calibration, selected, room.w, selected.flip ? -azimuth : azimuth) })
                    }
                  >
                    {viewLabel(shot.angle)}
                  </button>
                );
              })}
              <button
                type="button"
                className={chip(selected.flip)}
                aria-pressed={selected.flip}
                onClick={() => updateItem(selected.key, { flip: !selected.flip })}
              >
                Flip
              </button>
            </div>
            {selectedEntry ? (
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Altitude">
                <button
                  type="button"
                  className={chip(selected.altitude == null)}
                  aria-pressed={selected.altitude == null}
                  onClick={() => updateItem(selected.key, { altitude: null })}
                >
                  Auto · {Math.round(selectedEntry.autoAltitude)}°
                </button>
                {[...new Set(selectedProduct.photos.filter((photo) => photo.angle === selectedEntry.photo.angle).map((photo) => photo.altitudeDeg))]
                  .sort((a, b) => a - b)
                  .map((altitude) => {
                    const active = selected.altitude != null && Math.abs(selectedEntry.photo.altitudeDeg - altitude) < 0.5;
                    const shot = selectedProduct.photos.find(
                      (photo) => photo.angle === selectedEntry.photo.angle && Math.abs(photo.altitudeDeg - altitude) < 0.5,
                    );
                    return (
                      <button
                        key={altitude}
                        type="button"
                        className={chip(active)}
                        aria-pressed={active}
                        onClick={() =>
                          updateItem(selected.key, {
                            altitude,
                            yaw: yawForView(calibration, selected, room.w, selected.flip ? -shot.azimuthDeg : shot.azimuthDeg),
                          })
                        }
                      >
                        {altitude >= TOP_DEG ? "Top" : `${altitude}°`}
                      </button>
                    );
                  })}
              </div>
            ) : null}
            <label className="mt-3 block font-mono text-[12px] font-bold">
              Turn {Math.round(selected.yaw)}°
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                className="mt-1 block w-full accent-[#ff6b4a]"
                value={Math.round(selected.yaw)}
                onChange={(event) => updateItem(selected.key, { yaw: Number(event.target.value) })}
              />
            </label>
            {selectedEntry ? (
              <p className="mt-2 mb-0 font-mono text-[11px] text-ink/60">
                The camera sees it from {Math.round(selectedEntry.viewAzimuth)}° around. Showing{" "}
                {viewLabel(selectedEntry.photo.angle).toLowerCase()}, shot from {selectedEntry.photo.altitudeDeg}° up, bent to
                fit.
              </p>
            ) : null}
              </>
            )}
            {selectedProduct.category === "rug" ? null : (
            <label className="mt-3 flex items-center gap-2 font-mono text-[12px] font-bold">
              Off the floor
              <input
                type="number"
                min="0"
                step="1"
                className="w-20 rounded-lg border-2 border-ink bg-white px-2 py-0.5"
                value={selected.liftIn}
                onChange={(event) => updateItem(selected.key, { liftIn: Math.max(0, Number(event.target.value) || 0) })}
              />
              in
            </label>
            )}
            <label className="mt-3 block font-mono text-[12px] font-bold">
              Size fix {Math.round(selected.scale * 100)}%
              <input
                type="range"
                min={SIZE_MIN}
                max={SIZE_MAX}
                step={SIZE_STEP}
                className="mt-1 block w-full accent-[#ff6b4a]"
                value={selected.scale}
                onChange={(event) => updateItem(selected.key, { scale: Number(event.target.value) })}
              />
            </label>
            <button type="button" className={`${press} mt-3 border-2 bg-white px-4 py-1.5 text-sm`} onClick={() => removeItem(selected.key)}>
              Remove
            </button>
          </section>

      ) : null}
    </div>
  );

  const renderPanel = (
    <section className={`${panel} bg-yellow`}>
      <h2 className="m-0 font-display text-xl tracking-[0.02em]">Render</h2>
      <p className="mt-2 mb-0 text-xs leading-relaxed">
        Save the room keeps the mockup, the gap mask, and every piece&apos;s box and inches. Your AI reads it through the
        Furniture Finder MCP and does the final render, gap fill included.
      </p>
    </section>
  );
  const stepPanels = { photo: photoPanel, straighten: straightenPanel, pieces: piecesPanel, render: renderPanel };
  const hintVisible =
    saveHint &&
    !(saveHint.startsWith("Place a piece") && placed.length) &&
    !(saveHint.startsWith("The photo is still") && room && calibration);
  const saveStatus = hintVisible || needsSignIn || saved || (error && room) ? (
    <div className="mt-2 flex max-w-xl flex-col gap-1 font-mono text-[12px] leading-relaxed">
      {hintVisible ? <p className="m-0">{saveHint}</p> : null}
      {needsSignIn ? (
        <p className="m-0">
          Saving keeps the room on your account.{" "}
          <a className="font-bold" href="/login?back=%2Fdashboard" target="_blank" rel="noopener">
            Sign in in a new tab
          </a>
          , then come back here and save. This room stays as it is.
        </p>
      ) : null}
      {saved ? (
        <p className="m-0" role="status">
          Saved <strong>{saved}</strong> to <a href="/dashboard">your dashboard</a>. Ask your AI: &ldquo;Render Furniture Finder scene {saved}.&rdquo;
        </p>
      ) : null}
      {error && room ? (
        <p className="m-0 text-hot" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  ) : null;
  const saveButton = (
    <button
      type="button"
      className={`${press} border-[3px] bg-yellow px-4 py-1.5 font-display text-lg`}
      disabled={saving}
      onClick={save}
    >
      {saving ? "Saving…" : sceneId ? "Save changes" : "Save the room"}
    </button>
  );
  const steps = (
    <div className={wide ? "" : "mt-5"}>
    <nav className="flex flex-wrap items-center gap-2.5" aria-label="Steps">
      {STEPS.map((option, i) => {
        const active = step === option.id;
        const drops = wide && stepPanels[option.id];
        const opened = stepMenu === option.id;
        const button = (
          <button
            type="button"
            className={`${press} gap-2 border-[3px] px-4 py-1.5 font-display text-lg ${active ? "bg-hot text-white" : "bg-white"}`}
            aria-current={active ? "step" : undefined}
            aria-expanded={drops ? opened : undefined}
            aria-haspopup={drops ? "dialog" : undefined}
            onClick={() => {
              setStep(option.id);
              if (!drops) {
                setStepMenu(null);
                return;
              }
              setStepMenu((current) => (current === option.id ? null : option.id));
            }}
          >
            <span
              className={`grid h-6 w-6 place-items-center rounded-full border-2 font-mono text-[12px] ${
                active ? "border-white" : "border-ink"
              }`}
            >
              {i + 1}
            </span>
            {option.label}
            {drops ? (
              <svg className={`h-4 w-4 transition-transform ${opened ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            ) : null}
          </button>
        );
        if (!drops) return <span key={option.id}>{button}</span>;
        return (
          <div key={option.id} className="relative" ref={opened ? stepMenuRef : null}>
            {button}
            {opened ? (
              <div className="absolute top-full left-0 z-40 mt-2 w-[min(26rem,calc(100vw-2.5rem))] [&>*]:max-h-[min(70vh,40rem)] [&>*]:overflow-auto">
                {stepPanels[option.id]}
              </div>
            ) : null}
          </div>
        );
      })}
      {saveButton}
    </nav>
    {saveStatus}
    </div>
  );

  return (
    <div className={compact ? "" : wide ? "flex flex-col gap-6" : "grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"}>
      {wide ? (
        <div className="relative z-50 flex flex-wrap items-center gap-x-4 gap-y-3">
          <RoomPicker rooms={rooms} currentId={sceneId} />
          {steps}
        </div>
      ) : null}
      <div ref={entranceRef} className="min-w-0">
      <div
        className={`relative ${stageIn ? "" : `stage-enter ${entranceGo ? "entrance-go" : ""}`}`}
        onAnimationEnd={(event) => {
          if (event.animationName === "photo-in") setStageIn(true);
        }}
      >
      {tools ? (
        <button
          ref={trashRef}
          type="button"
          className={`${cornerButton} absolute bottom-3 left-3 z-30 transition-transform sm:bottom-5 sm:left-5 ${trashHot ? "scale-115 bg-hot text-white" : "bg-white"} disabled:opacity-60`}
          aria-label={selected ? `Remove ${selectedProduct?.name}` : "Remove a piece: drag it here, or select it first"}
          title="Drag a piece here to remove it"
          disabled={!selected && !trashHot}
          onClick={() => selected && removeItem(selected.key)}
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
        </button>
      ) : null}
        <div className="overflow-hidden rounded-[28px] border-[3px] border-ink bg-cream shadow-[8px_8px_0_0_#1a1a1a]">
          {room?.url && calibration ? (
            <div
              ref={stageRef}
              className="relative touch-none select-none"
              onPointerMove={onStageMove}
              onPointerLeave={() => setHoverGap(null)}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerDown={onStageDown}
            >
              <img className="photo-enter block h-auto w-full" src={room.url} alt="Room photo" draggable={false} />
              {hoverGap && !morph && !straightening ? (
                <>
                  <canvas ref={gapCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
                  <span
                    className={`pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-full border-2 border-ink bg-white px-3 py-1 font-mono text-[12px] font-bold whitespace-nowrap shadow-[3px_3px_0_0_#1a1a1a]`}
                    style={{ left: hoverGap.x, top: hoverGap.y }}
                    role="tooltip"
                  >
                    We&apos;ll gen fill this later
                  </span>
                </>
              ) : null}
              {straightening ? (
                <div className="pointer-events-none absolute inset-0 grid place-items-center bg-cream/35" role="status" aria-label="Straightening the photo">
                  <span className="h-12 w-12 animate-spin rounded-full border-[5px] border-ink/20 border-t-hot" />
                </div>
              ) : null}
              {morph ? (
                <StraightenMorph
                  key={morph.key}
                  image={morph.image}
                  from={morph.from}
                  to={morph.to}
                  onDone={() => setMorph(null)}
                />
              ) : null}

              {placed.map(({ item, product, photo, content, faces, rug }) => {
                const shown = stageWidth / room.w;
                if (!shown) return null;
                const enter = entering.has(item.key) && !leaving.has(item.key);
                return (
                  <button
                    key={item.key}
                    data-piece={item.key}
                    type="button"
                    className={`pointer-events-none absolute top-0 left-0 z-10 h-0 w-0 border-0 bg-transparent p-0 outline-none ${
                      leaving.has(item.key) ? "piece-leaving" : enter ? `piece-enter ${entranceGo ? "entrance-go" : ""}` : ""
                    }`}
                    style={
                      enter
                        ? {
                            transformOrigin: `${item.x * shown}px ${item.y * shown}px`,
                            animationDelay: `${entering.get(item.key)}ms`,
                            "--piece-drop": `${stageWidth * 0.16}px`,
                          }
                        : undefined
                    }
                    onAnimationEnd={(event) => {
                      if (event.target !== event.currentTarget || event.animationName !== "piece-in") return;
                      setEntering((current) => {
                        const next = new Map(current);
                        next.delete(item.key);
                        return next;
                      });
                    }}
                    aria-label={
                      rug
                        ? `${product.name}, lying on the floor. Left and right turn it, up and down tilt it, shift with left or right moves it, shift, command, or control with up or down changes its size, a tap jumps and holding eases it slowly, Delete removes it, Command or Control C and V copy and paste it.`
                        : `${product.name}. Left and right turn it to the next view, Alt with left and right turns it a little, up and down tilt the view, shift with left or right moves it, shift, command, or control with up or down changes its size, a tap jumps and holding eases it slowly, Delete removes it, Command or Control C and V copy and paste it.`
                    }
                    aria-pressed={item.key === selectedKey}
                    onKeyDown={(event) => onItemKey(event, item)}
                    onFocus={() => {
                      setSelectedKey(item.key);
                      setStep("pieces");
                    }}
                  >
                    {faces.map((face) => {
                      const frame = boundsOf(grown(face.region));
                      return (
                        <span
                          key={face.id}
                          className="absolute top-0 left-0 block overflow-hidden"
                          style={{
                            width: frame.width,
                            height: frame.height,
                            transform: cssMatrix(stageMatrix(face.H, shown, frame)),
                            transformOrigin: "0 0",
                            clipPath: `polygon(${grown(face.region)
                              .map((p) => `${p.x - frame.x}px ${p.y - frame.y}px`)
                              .join(", ")})`,
                          }}
                        >
                          <img
                            src={photo.path}
                            alt=""
                            draggable={false}
                            className="pointer-events-none absolute block"
                            style={{ maxWidth: "none", width: content.natW, height: content.natH, left: -frame.x, top: -frame.y }}
                          />
                        </span>
                      );
                    })}
                  </button>
                );
              })}

              <svg
                className="pointer-events-none absolute inset-0 z-20 h-full w-full"
                viewBox={`0 0 ${room.w} ${room.h}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {step === "straighten"
                  ? ["ceiling", "floor"].flatMap((key) =>
                      lineParts(room.geometry?.[key]).map((part, index) => (
                        <polyline
                          key={`${key}-${index}`}
                          points={part.map((p) => `${p.x},${p.y}`).join(" ")}
                          fill="none"
                          stroke={key === "floor" ? "#ff6b4a" : "#1a1a1a"}
                          strokeOpacity="0.7"
                          strokeWidth="2.5"
                          vectorEffect="non-scaling-stroke"
                        />
                      )),
                    )
                  : null}
                {step === "straighten" ? (
                  <line
                    x1="0"
                    x2={room.w}
                    y1={calibration.horizonY}
                    y2={calibration.horizonY}
                    stroke="#ff6b4a"
                    strokeWidth="2"
                    strokeDasharray="10 8"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
                {(step === "straighten" ? [7, 4] : []).map((width) => (
                  <line
                    key={width}
                    x1={calibration.stick.x}
                    x2={calibration.stick.x}
                    y1={calibration.stick.top}
                    y2={calibration.stick.bottom}
                    stroke={width === 7 ? "#1a1a1a" : "#ffd84d"}
                    strokeWidth={width}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {selected
                  ? placed
                      .filter((entry) => entry.item.key === selected.key)
                      .map(({ item, box, corners, rug }) => (
                        <g key={item.key}>
                          {rug ? (
                            <polygon
                              points={box.quad.map((p) => `${p.x},${p.y}`).join(" ")}
                              fill="none"
                              stroke="#ff6b4a"
                              strokeWidth="2"
                              strokeDasharray="6 5"
                              vectorEffect="non-scaling-stroke"
                            />
                          ) : (
                            <path
                              d={[
                                `M${corners.slice(0, 4).map((p) => `${p.x},${p.y}`).join("L")}Z`,
                                `M${corners.slice(4).map((p) => `${p.x},${p.y}`).join("L")}Z`,
                                ...[0, 1, 2, 3].map((i) => `M${corners[i].x},${corners[i].y}L${corners[i + 4].x},${corners[i + 4].y}`),
                              ].join("")}
                              fill="none"
                              stroke="#ff6b4a"
                              strokeOpacity="0.8"
                              strokeWidth="1.5"
                              strokeDasharray="6 5"
                              vectorEffect="non-scaling-stroke"
                            />
                          )}
                          <circle cx={item.x} cy={item.y} r={room.w / 200} fill="#ff6b4a" stroke="#1a1a1a" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                        </g>
                      ))
                  : null}
              </svg>

              {step === "straighten" ? (
                <>
                  <span
                    className="pointer-events-none absolute z-20 -translate-y-full rounded-full border-2 border-ink bg-white px-2 py-0.5 font-mono text-[11px] font-bold"
                    style={{ left: "1%", top: `calc(${pct(calibration.horizonY, room.h)} - 4px)` }}
                  >
                    Eye level{cameraIn ? ` · camera ${Math.round(cameraIn)} in up` : ""}
                  </span>
                  <span
                    className="pointer-events-none absolute z-20 -translate-x-1/2 rounded-full border-2 border-ink bg-yellow px-2 py-0.5 font-mono text-[11px] font-bold"
                    style={{ left: pct(calibration.stick.x, room.w), top: `calc(${pct((calibration.stick.top + calibration.stick.bottom) / 2, room.h)})` }}
                  >
                    {calibration.stick.inches} in
                  </span>

                  <button
                    type="button"
                    className={`${handle} bg-white`}
                    style={{ left: "96%", top: pct(calibration.horizonY, room.h) }}
                    aria-label="Eye level"
                    onPointerDown={(event) => startDrag(event, { kind: "horizon" })}
                  >
                    <span className="h-3 w-3 rounded-full bg-hot" />
                  </button>
                  <button
                    type="button"
                    className={`${handle} bg-yellow`}
                    style={{ left: pct(calibration.stick.x, room.w), top: pct(calibration.stick.top, room.h) }}
                    aria-label="Top of the height reference"
                    onPointerDown={(event) => startDrag(event, { kind: "stickTop" })}
                  />
                  <button
                    type="button"
                    className={`${handle} bg-yellow`}
                    style={{ left: pct(calibration.stick.x, room.w), top: pct(calibration.stick.bottom, room.h) }}
                    aria-label="Foot of the height reference, on the floor"
                    onPointerDown={(event) => startDrag(event, { kind: "stickBottom" })}
                  >
                    <span className="h-3 w-3 rounded-full bg-ink" />
                  </button>
              </>
              ) : null}
            </div>
          ) : (
            <div className="grid aspect-[4/3] place-items-center px-6 text-center font-mono text-[13px] text-ink/70">
              {error ?? "Straightening…"}
            </div>
          )}
        </div>


      {tools ? (
        <div ref={menuRef} className="absolute right-3 bottom-3 z-30 sm:right-5 sm:bottom-5">
          <button
            type="button"
            className={`${cornerButton} ${menuOpen ? "bg-hot text-white" : "bg-white"}`}
            aria-label="Add a piece"
            aria-expanded={menuOpen}
            disabled={!room}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg className={`h-6 w-6 transition-transform ${menuOpen ? "rotate-45" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          {menuOpen ? (
            <div className="absolute right-0 bottom-[calc(100%+10px)] z-40 flex w-72 flex-col overflow-hidden rounded-2xl border-[3px] border-ink bg-white shadow-[5px_5px_0_0_#1a1a1a]">
              <ul className="m-0 flex max-h-72 list-none flex-col gap-1.5 overflow-y-auto p-2 pb-0">
                {menuMatches.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-2 border-transparent bg-white px-2 py-1 text-left hover:border-ink hover:bg-cream"
                      onClick={() => addFromMenu(product)}
                    >
                      <img className="h-9 w-12 shrink-0 object-contain" src={product.photos[0]?.path} alt="" loading="lazy" />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{product.name}</span>
                    </button>
                  </li>
                ))}
                {menuMatches.length === 0 ? (
                  <li className="px-2 py-3 text-center font-mono text-[12px] text-ink/60">Nothing matches &ldquo;{menuQuery}&rdquo;</li>
                ) : null}
                <li className="sticky bottom-0 mt-auto bg-white pt-1 pb-2">
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-2 border-dashed border-ink bg-cream px-2 py-1.5 text-left hover:bg-yellow"
                    onClick={() => {
                      setMenuOpen(false);
                      setUnlockOpen(true);
                    }}
                  >
                    <span className="grid h-9 w-12 shrink-0 place-items-center">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">Custom piece</span>
                  </button>
                </li>
              </ul>
              <label className="flex items-center gap-2 border-t-[3px] border-ink px-3 py-2">
                <svg className="h-4 w-4 shrink-0 text-ink/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m16 16 4.5 4.5" />
                </svg>
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:font-normal placeholder:text-ink/50"
                  type="search"
                  placeholder="Search pieces"
                  aria-label="Search pieces"
                  value={menuQuery}
                  autoFocus
                  onChange={(event) => setMenuQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && menuMatches[0]) addFromMenu(menuMatches[0]);
                  }}
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}
      <UnlockModal open={unlockOpen} onClose={() => setUnlockOpen(false)} />
      </div>

        {compact ? (
          <div className="mt-4 flex flex-col items-center text-center">
            {saveButton}
            {saveStatus}
          </div>
        ) : wide ? null : steps}
      </div>

      {compact || wide ? null : (
      <aside className="flex flex-col gap-5">
        {step === "photo" ? photoPanel : null}
        {step === "straighten" ? straightenPanel : null}
        {step === "pieces" ? piecesPanel : null}
        {step === "render" ? renderPanel : null}
      </aside>
      )}
      {wide ? (
        <div className="mt-10 grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 md:gap-10">
          <section className="flex max-h-[28rem] min-h-0 min-w-0 flex-col overflow-hidden rounded-[22px] border-[3px] border-ink bg-white shadow-[6px_6px_0_0_#1a1a1a] md:aspect-square md:max-h-none" aria-labelledby="rooms-title">
            <h2 id="rooms-title" className={`${deckHeading} shrink-0 border-b-[3px] border-ink px-4 py-3`}>
              Saved rooms
            </h2>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <SavedRooms initial={rooms} openId={sceneId} stacked />
            </div>
          </section>
          <section className="flex max-h-[28rem] min-h-0 min-w-0 flex-col overflow-hidden rounded-[22px] border-[3px] border-ink bg-white shadow-[6px_6px_0_0_#1a1a1a] md:aspect-square md:max-h-none" aria-labelledby="furniture-title">
            <FurnitureList
              headingClass={deckHeading}
              note={room && calibration ? "" : "These can go in once the photo is ready."}
              roomType={roomKind}
              guessingRoom={guessingRoom}
              onRoom={(id) => {
                roomPickRef.current = true;
                setGuessingRoom(false);
                setRoomKind(id);
              }}
              products={products}
              counts={placedCounts}
              ready={Boolean(room && calibration)}
              onAdd={placeFromList}
              onCustom={() => setUnlockOpen(true)}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}

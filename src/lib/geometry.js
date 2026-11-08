// Room geometry the studio sizes from, whichever layout model produced it.
// A model adapter returns, in the original photo's pixels:
//
//   { source, width, height, horizon, vfovDeg, floor, ceiling }
//
// `horizon` is points along eye level, `floor` and `ceiling` are polylines
// where the walls meet them, and `vfovDeg` is the lens' top-to-bottom angle.
// Any of the last four may be null. Only the adapters below know a model's
// own response shape.

/** Adapter for ml/serve.py: uLayout boundaries with a GeoCalib horizon. */
export function fromLayoutService(body) {
  if (!body || !(body.width > 0) || !(body.height > 0)) return null;
  const line = (points) => (Array.isArray(points) && points.length > 1 ? points : null);
  return {
    source:
      body.floor_model === "moge"
        ? "MoGe-2 with GeoCalib"
        : `uLayout${body.variant ? ` ${body.variant}` : ""} with GeoCalib${body.floor_model === "segformer" ? " and SegFormer" : ""}`,
    width: body.width,
    height: body.height,
    horizon: Array.isArray(body.horizon) && body.horizon.length ? body.horizon : null,
    vfovDeg: Number.isFinite(body.calib?.vfov) ? body.calib.vfov : null,
    floor: line(body.floor),
    ceiling: line(body.ceiling),
  };
}

function mapLine(points, toOutput) {
  if (!points) return null;
  const out = points
    .map(([x, y]) => toOutput({ x, y }))
    .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.x - b.x);
  return out.length > 1 ? out : null;
}

/** Row of `line` at column `x`, or null outside the span it covers. */
export function rowAt(line, x) {
  if (!line || x < line[0].x || x > line[line.length - 1].x) return null;
  let lo = 0;
  let hi = line.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (line[mid].x <= x) lo = mid;
    else hi = mid;
  }
  const a = line[lo];
  const b = line[hi];
  // A doorway or a fireplace leaves a hole in the floor line. Bridging it
  // would invent a wall between the two stretches.
  const span = line[line.length - 1].x - line[0].x;
  if (b.x - a.x > Math.max(24, span * 0.03)) return null;
  if (b.x === a.x) return a.y;
  return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
}

/**
 * Carry the geometry into the room photo the studio shows. `toOutput` maps an
 * original-photo point into it, through the straighten warp when there was one.
 */
export function geometryInRoom(geometry, toOutput) {
  if (!geometry) return null;
  const horizon = (geometry.horizon ?? []).map(([x, y]) => toOutput({ x, y })).filter(Boolean);
  let focalPx = null;
  if (geometry.vfovDeg > 0) {
    const f = geometry.height / 2 / Math.tan((geometry.vfovDeg * Math.PI) / 360);
    const cx = geometry.width / 2;
    const cy = geometry.height / 2;
    const a = toOutput({ x: cx, y: cy - 20 });
    const b = toOutput({ x: cx, y: cy + 20 });
    if (a && b) focalPx = (f * Math.hypot(b.x - a.x, b.y - a.y)) / 40;
  }
  return {
    source: geometry.source,
    horizonY: horizon.length ? horizon.reduce((sum, p) => sum + p.y, 0) / horizon.length : null,
    focalPx,
    floor: mapLine(geometry.floor, toOutput),
    ceiling: mapLine(geometry.ceiling, toOutput),
  };
}

/**
 * Scale from the room itself: wherever a column shows both the floor line and
 * the ceiling line of the same wall, a ceiling of `ceilingIn` fixes the camera
 * height. The median column becomes the stick. Null when the lines are missing
 * or do not straddle eye level.
 */
export function calibrationFromGeometry(room, ceilingIn = 96) {
  const g = room?.geometry;
  if (!g || g.horizonY == null || !g.floor || !g.ceiling) return null;
  const samples = [];
  for (let i = 0; i <= 48; i++) {
    const x = room.w * (0.04 + (0.92 * i) / 48);
    const bottom = rowAt(g.floor, x);
    const top = rowAt(g.ceiling, x);
    if (bottom == null || top == null) continue;
    if (top < 0 || bottom > room.h || bottom < g.horizonY + 8 || top > g.horizonY - 8) continue;
    samples.push({ x, top, bottom, camera: (ceilingIn * (bottom - g.horizonY)) / (bottom - top) });
  }
  if (samples.length < 3) return null;
  samples.sort((a, b) => a.camera - b.camera);
  const pick = samples[samples.length >> 1];
  return {
    stick: { x: pick.x, top: pick.top, bottom: pick.bottom, inches: ceilingIn, ref: "ceiling" },
    horizonY: g.horizonY,
    focalPx: g.focalPx,
    origin: "model",
  };
}

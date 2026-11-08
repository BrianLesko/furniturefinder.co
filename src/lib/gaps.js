// The separate gaps in a straightened photo, from the warp's hole mask, so
// one can be picked out under the pointer.

/**
 * Label the connected white areas of `mask` (a canvas from warpInfo).
 * Returns null when there are none.
 */
export function gapRegions(mask) {
  if (!mask) return null;
  const { width: w, height: h } = mask;
  const rgba = mask.getContext("2d").getImageData(0, 0, w, h).data;
  const labels = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let count = 0;
  for (let start = 0; start < w * h; start++) {
    if (labels[start] || rgba[start * 4] < 128) continue;
    count += 1;
    labels[start] = count;
    let top = 0;
    stack[top++] = start;
    while (top) {
      const i = stack[--top];
      const x = i % w;
      const near = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
      for (const j of near) {
        if (j < 0 || j >= w * h || labels[j] || rgba[j * 4] < 128) continue;
        labels[j] = count;
        stack[top++] = j;
      }
    }
  }
  return count ? { w, h, labels, count } : null;
}

/** The gap under room pixel `p`, as a label from 1, or 0 for none. */
export function gapAt(regions, p) {
  if (!regions) return 0;
  const x = Math.floor(p.x);
  const y = Math.floor(p.y);
  if (x < 0 || y < 0 || x >= regions.w || y >= regions.h) return 0;
  return regions.labels[y * regions.w + x];
}

function filled(w, h, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  paint(canvas.getContext("2d"));
  return canvas;
}

// Distance in pixels from each pixel of gap `id` to the nearest pixel outside
// it (the photo edge counts as outside), over the gap's bounding box.
function insideDistance(regions, id) {
  const { w, h, labels } = regions;
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] !== id) continue;
    const x = i % w;
    const y = (i - x) / w;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const d = new Float32Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) d[y * bw + x] = labels[(y + y0) * w + x + x0] === id ? Infinity : 0;
  }
  const at = (x, y) => (x < 0 || y < 0 || x >= bw || y >= bh ? 0 : d[y * bw + x]);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const i = y * bw + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + Math.SQRT2, at(x + 1, y - 1) + Math.SQRT2);
    }
  }
  for (let y = bh - 1; y >= 0; y--) {
    for (let x = bw - 1; x >= 0; x--) {
      const i = y * bw + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + Math.SQRT2, at(x - 1, y + 1) + Math.SQRT2);
    }
  }
  return { d, x0, y0, bw, bh };
}

// In screen pixels: line weights for the outline and the hatch, the hatch
// spacing, and the clear space between hatch ends and the outline (0.75 of
// the 4px spacing unit).
const LINE = 2.5;
const HATCH = 2;
const SPACING = 7;
const CLEAR = 3;
const INK = "#1a1a1a";

// The gap's border as a polygon on pixel corners, walked with the gap on the
// right, then straightened so slanted edges are single lines, not stairs.
function traceOutline(d, bw, bh, px) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < bw && y < bh && d[y * bw + x] > 0;
  let start = 0;
  while (!d[start]) start++;
  const sx = start % bw;
  const sy = (start - sx) / bw;
  const corners = [];
  let [x, y, dx, dy] = [sx, sy, 1, 0];
  let steps = 4 * (bw + 1) * (bh + 1);
  do {
    if (!steps--) break;
    x += dx;
    y += dy;
    // Pixels ahead of corner (x, y), to the left and right of the heading.
    const left = inside(x + (dx + dy - 1) / 2, y + (dy - dx - 1) / 2);
    const right = inside(x + (dx - dy - 1) / 2, y + (dy + dx - 1) / 2);
    let next;
    if (left) next = [dy, -dx];
    else if (right) next = [dx, dy];
    else next = [-dy, dx];
    if (next[0] !== dx || next[1] !== dy) corners.push({ x, y });
    [dx, dy] = next;
  } while (x !== sx || y !== sy || dx !== 1 || dy !== 0);
  return simplify(corners, Math.max(1.5, px));
}

// Douglas-Peucker on a closed polygon.
function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const far = (a, b, from, to) => {
    let best = -1;
    let at = -1;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    for (let i = from + 1; i < to; i++) {
      const p = points[i % points.length];
      const dist = Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len;
      if (dist > best) [best, at] = [dist, i];
    }
    return [best, at];
  };
  const keep = new Set();
  const split = (from, to) => {
    const [dist, at] = far(points[from % points.length], points[to % points.length], from, to);
    if (dist > tolerance) {
      keep.add(at % points.length);
      split(from, at);
      split(at, to);
    }
  };
  let opposite = 0;
  for (let i = 1, best = -1; i < points.length; i++) {
    const dist = Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y);
    if (dist > best) [best, opposite] = [dist, i];
  }
  keep.add(0);
  keep.add(opposite);
  split(0, opposite);
  split(opposite, points.length);
  return [...keep].sort((a, b) => a - b).map((i) => points[i]);
}

/**
 * Gap `id` outlined and hatched, on a canvas the size of the room. `px` is
 * room pixels per screen pixel, so the lines read the same at any size.
 */
export function drawGap(regions, id, px) {
  const { w, h } = regions;
  const { d, x0, y0, bw, bh } = insideDistance(regions, id);
  const line = Math.max(1, LINE * px);

  const outline = traceOutline(d, bw, bh, px).map((p) => ({ x: p.x + x0, y: p.y + y0 }));

  return filled(w, h, (ctx) => {
    // Twice the weight, clipped to the gap, leaves one weight inside it.
    ctx.save();
    ctx.beginPath();
    outline.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = INK;
    ctx.lineWidth = line * 2;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = INK;
    // A cap reaches half a line past its segment's end.
    const hatch = Math.max(1, HATCH * px);
    const reach = line + CLEAR * px + hatch / 2;
    const step = SPACING * px * Math.SQRT2;
    ctx.lineWidth = hatch;
    ctx.lineCap = "round";
    ctx.beginPath();
    // Lines x + y = c, running up and to the right.
    for (let c = step / 2; c < bw + bh; c += step) {
      let start = null;
      const xa = Math.max(0, Math.ceil(c - bh + 1));
      const xb = Math.min(bw - 1, Math.floor(c));
      for (let x = xa; x <= xb + 1; x++) {
        const y = Math.round(c - x);
        const clear = x <= xb && y >= 0 && y < bh && d[y * bw + x] >= reach;
        if (clear && start === null) start = x;
        if (!clear && start !== null) {
          const end = x - 1;
          if (end - start >= 1) {
            ctx.moveTo(x0 + start + 0.5, y0 + c - start + 0.5);
            ctx.lineTo(x0 + end + 0.5, y0 + c - end + 0.5);
          }
          start = null;
        }
      }
    }
    ctx.stroke();
  });
}

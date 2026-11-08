// Map a wall quadrilateral to a rectangle and warp the photo with that
// homography, so those edges become one-point (parallel verticals). For
// corner shots, push the vertical vanishing point to infinity instead.

const MAX_EDGE = 2000;

function point(p) {
  if (Array.isArray(p)) return { x: Number(p[0]), y: Number(p[1]) };
  return { x: Number(p.x), y: Number(p.y) };
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function convexQuad(q) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(z) < 1e-3) return false;
    const s = z > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

// Gauss-Jordan solve of an 8×8 system. Returns null when the quad is degenerate.
function solve8(A, b) {
  const n = 8;
  const M = new Array(n);
  for (let i = 0; i < n; i++) {
    const row = new Array(n + 1);
    for (let j = 0; j < n; j++) row[j] = A[i][j];
    row[n] = b[i];
    M[i] = row;
  }
  for (let col = 0; col < n; col++) {
    let pivot = col;
    let best = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > best) {
        best = v;
        pivot = r;
      }
    }
    if (best < 1e-12) return null;
    if (pivot !== col) {
      const tmp = M[col];
      M[col] = M[pivot];
      M[pivot] = tmp;
    }
    const div = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const h = new Array(n);
  for (let i = 0; i < n; i++) h[i] = M[i][n];
  return h;
}

// Homography mapping `from` (4 points) onto `to`. Row-major 3×3, h22 = 1.
function homography(from, to) {
  const A = new Array(8);
  const b = new Array(8);
  for (let i = 0; i < 4; i++) {
    const x = from[i].x;
    const y = from[i].y;
    const u = to[i].x;
    const v = to[i].y;
    const r = i * 2;
    A[r] = [x, y, 1, 0, 0, 0, -u * x, -u * y];
    b[r] = u;
    A[r + 1] = [0, 0, 0, x, y, 1, -v * x, -v * y];
    b[r + 1] = v;
  }
  const h = solve8(A, b);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function apply(H, x, y) {
  const den = H[6] * x + H[7] * y + H[8];
  if (!Number.isFinite(den) || Math.abs(den) < 1e-7) return null;
  const u = (H[0] * x + H[1] * y + H[2]) / den;
  const v = (H[3] * x + H[4] * y + H[5]) / den;
  if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
  return [u, v, den];
}

const rasterCache = new WeakMap();

function raster(image) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return null;
  const srcKey = image.currentSrc || image.src || "";
  const hit = rasterCache.get(image);
  if (hit && hit.width === width && hit.height === height && hit.srcKey === srcKey) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  const record = { width, height, data, srcKey };
  rasterCache.set(image, record);
  return record;
}

// Warp the whole photo through `toDest`, sampling back with `toSource`.
// `keep` points are always inside the output, and the frame is bounded to
// `limit` around `center` so a far vanishing point cannot blow it up.
function renderWarp(src, toDest, toSource, keep, center, limit) {
  const mid = apply(toDest, center.x, center.y);
  if (!mid) return null;
  const front = mid[2] > 0 ? 1 : -1;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const take = (x, y) => {
    const p = apply(toDest, x, y);
    if (!p || Math.sign(p[2]) !== front) return;
    if (Math.hypot(p[0] - mid[0], p[1] - mid[1]) > limit) return;
    if (p[0] < minX) minX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] > maxY) maxY = p[1];
  };
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    take(t * (src.width - 1), 0);
    take(t * (src.width - 1), src.height - 1);
    take(0, t * (src.height - 1));
    take(src.width - 1, t * (src.height - 1));
  }
  for (const p of keep) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX) || maxX - minX < 2 || maxY - minY < 2) return null;

  const bw = maxX - minX;
  const bh = maxY - minY;
  const fit = Math.min(1, MAX_EDGE / Math.max(bw, bh));
  const ow = Math.max(2, Math.round(bw * fit));
  const oh = Math.max(2, Math.round(bh * fit));
  const stepX = bw / ow;
  const stepY = bh / oh;

  const dst = new Uint8ClampedArray(ow * oh * 4);
  const sw = src.width;
  const sh = src.height;
  const pix = src.data;
  const H = toSource;

  for (let y = 0; y < oh; y++) {
    const Y = minY + (y + 0.5) * stepY;
    let A = H[0] * (minX + 0.5 * stepX) + H[1] * Y + H[2];
    let B = H[3] * (minX + 0.5 * stepX) + H[4] * Y + H[5];
    let C = H[6] * (minX + 0.5 * stepX) + H[7] * Y + H[8];
    const dA = H[0] * stepX;
    const dB = H[3] * stepX;
    const dC = H[6] * stepX;
    const row = y * ow * 4;
    for (let x = 0; x < ow; x++) {
      if (C * front > 1e-6) {
        const inv = 1 / C;
        const sx = A * inv;
        const sy = B * inv;
        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        const x1 = x0 + 1;
        const y1 = y0 + 1;
        if (x0 >= 0 && y0 >= 0 && x1 < sw && y1 < sh) {
          const wx = sx - x0;
          const wy = sy - y0;
          const w00 = (1 - wx) * (1 - wy);
          const w10 = wx * (1 - wy);
          const w01 = (1 - wx) * wy;
          const w11 = wx * wy;
          const i00 = (y0 * sw + x0) * 4;
          const i10 = i00 + 4;
          const i01 = i00 + sw * 4;
          const i11 = i01 + 4;
          const di = row + x * 4;
          dst[di] = pix[i00] * w00 + pix[i10] * w10 + pix[i01] * w01 + pix[i11] * w11;
          dst[di + 1] = pix[i00 + 1] * w00 + pix[i10 + 1] * w10 + pix[i01 + 1] * w01 + pix[i11 + 1] * w11;
          dst[di + 2] = pix[i00 + 2] * w00 + pix[i10 + 2] * w10 + pix[i01 + 2] * w01 + pix[i11 + 2] * w11;
          dst[di + 3] = pix[i00 + 3] * w00 + pix[i10 + 3] * w10 + pix[i01 + 3] * w01 + pix[i11 + 3] * w11;
        }
      }
      A += dA;
      B += dB;
      C += dC;
    }
  }

  const mask = holeMask(dst, ow, oh);
  fillOutside(dst, ow, oh);

  const canvas = document.createElement("canvas");
  canvas.width = ow;
  canvas.height = oh;
  canvas.getContext("2d").putImageData(new ImageData(dst, ow, oh), 0, 0);
  warps.set(canvas, {
    mask,
    toOutput(p) {
      const q = point(p);
      const d = apply(toDest, q.x, q.y);
      if (!d || Math.sign(d[2]) !== front) return null;
      return { x: (d[0] - minX) / stepX, y: (d[1] - minY) / stepY };
    },
  });
  return canvas;
}

const warps = new WeakMap();

/**
 * Homography from quad `from` onto quad `to`, row-major 3×3, or null when
 * either is degenerate.
 */
export function quadHomography(from, to) {
  return homography(from.map(point), to.map(point));
}

function insideConvex(poly, x, y) {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const z = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (z === 0) continue;
    if (!sign) sign = Math.sign(z);
    else if (Math.sign(z) !== sign) return false;
  }
  return true;
}

/** Inverse of a 3×3 homography, or null when it is singular. */
export function invertHomography(H) {
  return invert3(H);
}

/**
 * Paint the part of `image` inside quad `from` (image pixels) onto quad `to`
 * of the 2D context `ctx`, in perspective and over what is already there.
 */
export function paintWarped(ctx, image, from, to) {
  const H = homography(from.map(point), to.map(point));
  if (H) paintMapped(ctx, image, H, from.map(point));
}

/**
 * Paint `image` onto the 2D context `ctx` through homography `H` (image
 * pixels to canvas pixels), over what is already there. Only the canvas
 * area covered by the image points `outline` is visited, and with `clip`
 * only image pixels inside that convex outline are painted.
 */
export function paintMapped(ctx, image, H, outline, clip = false) {
  const back = invert3(H);
  const src = raster(image);
  if (!back || !src) return;
  const to = [];
  for (const p of outline) {
    const q = apply(H, p.x, p.y);
    if (!q || q[2] <= 0) return;
    to.push({ x: q[0], y: q[1] });
  }
  const xs = to.map((p) => p.x);
  const ys = to.map((p) => p.y);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const x1 = Math.min(ctx.canvas.width, Math.ceil(Math.max(...xs)));
  const y1 = Math.min(ctx.canvas.height, Math.ceil(Math.max(...ys)));
  if (x1 <= x0 || y1 <= y0) return;
  const w = x1 - x0;
  const h = y1 - y0;
  const frame = ctx.getImageData(x0, y0, w, h);
  const out = frame.data;
  const pix = src.data;
  const sw = src.width;
  const sh = src.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = apply(back, x0 + x + 0.5, y0 + y + 0.5);
      if (!p || (clip && !insideConvex(outline, p[0], p[1]))) continue;
      const sx = p[0] - 0.5;
      const sy = p[1] - 0.5;
      const ix = Math.floor(sx);
      const iy = Math.floor(sy);
      if (ix < 0 || iy < 0 || ix + 1 >= sw || iy + 1 >= sh) continue;
      const fx = sx - ix;
      const fy = sy - iy;
      const i00 = (iy * sw + ix) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + sw * 4;
      const i11 = i01 + 4;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;
      const a = (pix[i00 + 3] * w00 + pix[i10 + 3] * w10 + pix[i01 + 3] * w01 + pix[i11 + 3] * w11) / 255;
      if (a <= 0) continue;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const s = pix[i00 + c] * w00 + pix[i10 + c] * w10 + pix[i01 + c] * w01 + pix[i11 + c] * w11;
        out[o + c] = s * a + out[o + c] * (1 - a);
      }
      out[o + 3] = 255;
    }
  }
  ctx.putImageData(frame, x0, y0);
}

// White where the warp found no source pixel, so the guess painted there is
// known to be invented. Null when the frame has no gaps.
function holeMask(dst, ow, oh) {
  const out = new Uint8ClampedArray(ow * oh * 4);
  let holes = 0;
  for (let i = 0; i < out.length; i += 4) {
    const v = dst[i + 3] < 16 ? 255 : 0;
    if (v) holes++;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = 255;
  }
  if (!holes) return null;
  const canvas = document.createElement("canvas");
  canvas.width = ow;
  canvas.height = oh;
  canvas.getContext("2d").putImageData(new ImageData(out, ow, oh), 0, 0);
  return canvas;
}

/**
 * What a straighten call knows about its output canvas: `mask` is a canvas
 * that is white over the filled gaps (or null), and `toOutput` carries a
 * point from the original photo into output pixels.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{ mask: HTMLCanvasElement | null, toOutput: (p: {x:number,y:number}) => {x:number,y:number} | null } | null}
 */
export function warpInfo(canvas) {
  return warps.get(canvas) ?? null;
}

/**
 * Warp `image` so `quad` (TL, TR, BR, BL, in image pixels) becomes a rectangle.
 * The same homography is applied to the whole photo, which makes verticals
 * that share that wall's uprights parallel. Returns a canvas, or null when
 * the quad cannot define a warp.
 *
 * @param {CanvasImageSource} image
 * @param {Array<{x:number,y:number}|[number,number]>} quad
 * @returns {HTMLCanvasElement | null}
 */
export function straightenQuad(image, quad) {
  if (!image || !quad || quad.length !== 4 || typeof document === "undefined") return null;
  const q = quad.map(point);
  if (q.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  if (!convexQuad(q)) return null;
  for (let i = 0; i < 4; i++) {
    if (dist(q[i], q[(i + 1) % 4]) < 4) return null;
  }

  const src = raster(image);
  if (!src) return null;

  const dw = Math.max(dist(q[0], q[1]), dist(q[3], q[2]));
  const dh = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  const dest = [
    { x: 0, y: 0 },
    { x: dw, y: 0 },
    { x: dw, y: dh },
    { x: 0, y: dh },
  ];
  const toSource = homography(dest, q);
  const toDest = homography(q, dest);
  if (!toSource || !toDest) return null;
  const center = {
    x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4,
    y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4,
  };
  return renderWarp(src, toDest, toSource, dest, center, 8 * Math.max(dw, dh));
}

function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  return [
    A / det,
    -(b * i - c * h) / det,
    (b * f - c * e) / det,
    B / det,
    (a * i - c * g) / det,
    -(a * f - c * d) / det,
    C / det,
    -(a * h - b * g) / det,
    (a * e - b * d) / det,
  ];
}

function multiply3(m, n) {
  const out = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] = m[r * 3] * n[c] + m[r * 3 + 1] * n[3 + c] + m[r * 3 + 2] * n[6 + c];
    }
  }
  return out;
}

/**
 * Make two lines that are vertical in the room stand upright, and with them
 * every other vertical in the photo. Horizontal perspective is left as it
 * was, so a corner shot stays a corner shot. Each line is [top, bottom] in
 * image pixels. Returns a canvas, or null when the lines meet inside the
 * photo or cannot define a warp.
 *
 * @param {CanvasImageSource} image
 * @param {Array<Array<{x:number,y:number}|[number,number]>>} lines
 * @returns {HTMLCanvasElement | null}
 */
export function straightenVerticals(image, lines) {
  if (!image || !lines || lines.length !== 2 || typeof document === "undefined") return null;
  const pts = lines.map((line) => line.map(point));
  if (pts.some((line) => line.length !== 2 || line.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))) {
    return null;
  }
  if (pts.some(([a, b]) => Math.abs(b.y - a.y) < 8)) return null;

  const src = raster(image);
  if (!src) return null;
  const cx = src.width / 2;
  const cy = src.height / 2;
  const span = Math.max(src.width, src.height);

  // Centered coordinates keep the vanishing point math well conditioned.
  const homog = (p) => [p.x - cx, p.y - cy, 1];
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l1 = cross(homog(pts[0][0]), homog(pts[0][1]));
  const l2 = cross(homog(pts[1][0]), homog(pts[1][1]));
  const v = cross(l1, l2);
  const norm = Math.hypot(v[0], v[1], v[2]);
  if (!norm) return null;

  // P sends the vertical vanishing point to infinity. If the lines are
  // already parallel there is nothing to push.
  let P = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  let dx;
  let dy;
  if (Math.abs(v[2]) / norm > 1e-9 && Math.abs(v[1] / v[2]) > 1e-6) {
    const vx = v[0] / v[2];
    const vy = v[1] / v[2];
    if (Math.abs(vy) < 0.75 * src.height) return null;
    P = [1, 0, 0, 0, 1, 0, 0, -1 / vy, 1];
    dx = vx;
    dy = vy;
  } else {
    dx = v[0];
    dy = v[1];
  }
  if (Math.abs(dy) < 1e-9) return null;
  // Shear the remaining lean out. Horizontal lines stay horizontal.
  const S = [1, -dx / dy, 0, 0, 1, 0, 0, 0, 1];
  const T = [1, 0, -cx, 0, 1, -cy, 0, 0, 1];
  const Ti = [1, 0, cx, 0, 1, cy, 0, 0, 1];
  const toDest = multiply3(Ti, multiply3(S, multiply3(P, T)));
  const toSource = invert3(toDest);
  if (!toSource) return null;
  return renderWarp(src, toDest, toSource, [], { x: cx, y: cy }, 4 * span);
}

/**
 * Turn the camera toward level, as if the photo had been taken with it held
 * straighter. `calib` is GeoCalib's camera: focal length `f` and centre `c`
 * in image pixels, and `gravity`, the up direction in camera coordinates
 * (x right, y down, z forward). Roll always comes out fully; `strength` is
 * the share of the up or down tilt taken out, so 1 makes verticals parallel
 * and less leaves some lean but stretches the photo less. With `crop`, the
 * result is cut to the largest frame of the photo's own shape that has no
 * gaps; otherwise gaps are filled as in the other warps.
 *
 * @param {CanvasImageSource} image
 * @param {{f: number, c: number[], gravity: number[]}} calib
 * @param {{strength?: number, crop?: boolean}} [options]
 * @returns {HTMLCanvasElement | null}
 */
export function straightenTilt(image, calib, { strength = 1, crop = false } = {}) {
  if (!image || !calib?.gravity || !calib.f || typeof document === "undefined") return null;
  const src = raster(image);
  if (!src) return null;
  const { f } = calib;
  const [cx, cy] = calib.c ?? [src.width / 2, src.height / 2];
  const up = unit(calib.gravity);
  if (!up) return null;

  // Roll: spin about the lens axis until up has no sideways part.
  const spin = Math.atan2(up[0], -up[1]);
  const Rz = [Math.cos(spin), Math.sin(spin), 0, -Math.sin(spin), Math.cos(spin), 0, 0, 0, 1];
  const rolled = rotate(Rz, up);
  // Tilt: swing up toward straight up (0, -1, 0) by `strength` of the way.
  const lean = Math.atan2(rolled[2], -rolled[1]);
  const t = lean * Math.max(0, Math.min(1, strength));
  const Rx = [1, 0, 0, 0, Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t)];
  const R = multiply3(Rx, Rz);

  const K = [f, 0, cx, 0, f, cy, 0, 0, 1];
  const Ki = [1 / f, 0, -cx / f, 0, 1 / f, -cy / f, 0, 0, 1];
  const toDest = multiply3(K, multiply3(R, Ki));
  const toSource = invert3(toDest);
  if (!toSource) return null;
  const canvas = renderWarp(src, toDest, toSource, [], { x: cx, y: cy }, 4 * Math.max(src.width, src.height));
  if (!canvas || !crop) return canvas;
  return cropToPhoto(canvas, src.width, src.height);
}

function unit(v) {
  const n = Math.hypot(v[0], v[1], v[2]);
  return n ? [v[0] / n, v[1] / n, v[2] / n] : null;
}

function rotate(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/** Largest frame with the source's shape, centred on the photo's middle, that the warped photo fills. */
function cropToPhoto(canvas, width, height) {
  const info = warpInfo(canvas);
  if (!info) return canvas;
  const edge = [];
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const s = i / steps;
    edge.push({ x: s * (width - 1), y: 0 });
  }
  for (let i = 0; i < steps; i++) edge.push({ x: width - 1, y: (i / steps) * (height - 1) });
  for (let i = 0; i < steps; i++) edge.push({ x: (1 - i / steps) * (width - 1), y: height - 1 });
  for (let i = 0; i < steps; i++) edge.push({ x: 0, y: (1 - i / steps) * (height - 1) });
  const outline = edge.map((p) => info.toOutput(p));
  const middle = info.toOutput({ x: width / 2, y: height / 2 });
  if (!middle || outline.some((p) => !p)) return canvas;

  const ratio = width / height;
  const fits = (cx, cy, half) => {
    const hw = half * ratio;
    return [
      [cx - hw, cy - half],
      [cx + hw, cy - half],
      [cx + hw, cy + half],
      [cx - hw, cy + half],
    ].every(([x, y]) => insideConvex(outline, x, y));
  };
  const largest = (cx, cy) => {
    let lo = 0;
    let hi = Math.max(canvas.width, canvas.height);
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (fits(cx, cy, mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  // The warped photo is a trapezoid, so a slightly off-centre frame can be
  // much bigger. Straying further crops the subject off one side.
  let best = { x: middle.x, y: middle.y, half: largest(middle.x, middle.y) };
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      const x = middle.x + (j / 20) * canvas.width;
      const y = middle.y + (i / 20) * canvas.height;
      const half = largest(x, y);
      if (half > best.half) best = { x, y, half };
    }
  }
  if (best.half < 8) return canvas;
  const w = Math.round(2 * best.half * ratio);
  const h = Math.round(2 * best.half);
  const left = Math.round(best.x - best.half * ratio);
  const top = Math.round(best.y - best.half);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d").drawImage(canvas, left, top, w, h, 0, 0, w, h);
  warps.set(out, {
    mask: null,
    toOutput(p) {
      const q = info.toOutput(p);
      return q ? { x: q.x - left, y: q.y - top } : null;
    },
  });
  return out;
}

/**
 * Draw `image` with a band of `fraction` × its height above and below,
 * filled with the same blurred guess the straightened photo uses for its
 * gaps. Returns a canvas, or null when the image has no size yet.
 *
 * @param {CanvasImageSource} image
 * @param {number} fraction
 * @returns {HTMLCanvasElement | null}
 */
export function padWithFill(image, fraction) {
  if (!image || typeof document === "undefined") return null;
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return null;
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const ow = Math.max(1, Math.round(width * scale));
  const ih = Math.max(1, Math.round(height * scale));
  const pad = Math.max(1, Math.round(ih * fraction));
  const oh = ih + 2 * pad;
  const canvas = document.createElement("canvas");
  canvas.width = ow;
  canvas.height = oh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, pad, ow, ih);
  const frame = ctx.getImageData(0, 0, ow, oh);
  fillOutside(frame.data, ow, oh);
  ctx.putImageData(frame, 0, 0);
  return canvas;
}

const FILL_EDGE = 180;

function samplePlane(plane, w, h, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const wx = x - x0;
  const wy = y - y0;
  const xx0 = x0 < 0 ? 0 : x0 >= w ? w - 1 : x0;
  const yy0 = y0 < 0 ? 0 : y0 >= h ? h - 1 : y0;
  const xx1 = x1 < 0 ? 0 : x1 >= w ? w - 1 : x1;
  const yy1 = y1 < 0 ? 0 : y1 >= h ? h - 1 : y1;
  const w00 = (1 - wx) * (1 - wy);
  const w10 = wx * (1 - wy);
  const w01 = (1 - wx) * wy;
  const w11 = wx * wy;
  return plane[yy0 * w + xx0] * w00 + plane[yy0 * w + xx1] * w10 + plane[yy1 * w + xx0] * w01 + plane[yy1 * w + xx1] * w11;
}

function boxBlur(src, w, h, radius) {
  if (radius < 1) return src;
  const tmp = new Float32Array(src.length);
  const dst = new Float32Array(src.length);
  const win = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -radius; x <= radius; x++) {
      const xx = x < 0 ? 0 : x >= w ? w - 1 : x;
      sum += src[y * w + xx];
    }
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / win;
      const remove = x - radius;
      const add = x + radius + 1;
      sum -= src[y * w + (remove < 0 ? 0 : remove >= w ? w - 1 : remove)];
      sum += src[y * w + (add < 0 ? 0 : add >= w ? w - 1 : add)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) {
      const yy = y < 0 ? 0 : y >= h ? h - 1 : y;
      sum += tmp[yy * w + x];
    }
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = sum / win;
      const remove = y - radius;
      const add = y + radius + 1;
      sum -= tmp[(remove < 0 ? 0 : remove >= h ? h - 1 : remove) * w + x];
      sum += tmp[(add < 0 ? 0 : add >= h ? h - 1 : add) * w + x];
    }
  }
  return dst;
}

// Empty corners of the straightened frame get a soft continuation of the
// nearby photo. A short image pyramid carries color into the holes, then a
// small blur keeps the guess from looking like a copy of the edge.
function fillOutside(dst, ow, oh) {
  let holes = 0;
  for (let i = 3; i < dst.length; i += 4) {
    if (dst[i] < 16) holes++;
  }
  if (!holes) return;

  const scale = Math.min(1, FILL_EDGE / Math.max(ow, oh));
  const dw = Math.max(2, Math.round(ow * scale));
  const dh = Math.max(2, Math.round(oh * scale));
  let w = dw;
  let h = dh;
  let red = new Float32Array(w * h);
  let green = new Float32Array(w * h);
  let blue = new Float32Array(w * h);
  let cover = new Float32Array(w * h);

  for (let y = 0; y < dh; y++) {
    const y0 = Math.min(oh - 1, Math.floor((y * oh) / dh));
    let y1 = Math.floor(((y + 1) * oh) / dh);
    if (y1 <= y0) y1 = y0 + 1;
    if (y1 > oh) y1 = oh;
    for (let x = 0; x < dw; x++) {
      const x0 = Math.min(ow - 1, Math.floor((x * ow) / dw));
      let x1 = Math.floor(((x + 1) * ow) / dw);
      if (x1 <= x0) x1 = x0 + 1;
      if (x1 > ow) x1 = ow;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * ow + xx) * 4;
          if (dst[i + 3] < 16) continue;
          r += dst[i];
          g += dst[i + 1];
          b += dst[i + 2];
          n++;
        }
      }
      const o = y * dw + x;
      if (n) {
        red[o] = r / n;
        green[o] = g / n;
        blue[o] = b / n;
        cover[o] = n / ((y1 - y0) * (x1 - x0));
      }
    }
  }

  const mask = cover.slice();
  const levels = [{ w, h, red, green, blue, cover }];
  while (w > 4 && h > 4) {
    const nw = Math.ceil(w / 2);
    const nh = Math.ceil(h / 2);
    const nr = new Float32Array(nw * nh);
    const ng = new Float32Array(nw * nh);
    const nb = new Float32Array(nw * nh);
    const na = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const xx = x * 2 + dx;
            const yy = y * 2 + dy;
            if (xx >= w || yy >= h) continue;
            const i = yy * w + xx;
            if (cover[i] <= 0) continue;
            r += red[i];
            g += green[i];
            b += blue[i];
            n++;
          }
        }
        if (n) {
          const o = y * nw + x;
          nr[o] = r / n;
          ng[o] = g / n;
          nb[o] = b / n;
          na[o] = 1;
        }
      }
    }
    red = nr;
    green = ng;
    blue = nb;
    cover = na;
    w = nw;
    h = nh;
    levels.push({ w, h, red, green, blue, cover });
  }

  const coarse = levels[levels.length - 1];
  for (let pass = 0; pass < coarse.w + coarse.h; pass++) {
    let open = 0;
    const nr = coarse.red.slice();
    const ng = coarse.green.slice();
    const nb = coarse.blue.slice();
    const na = coarse.cover.slice();
    for (let y = 0; y < coarse.h; y++) {
      for (let x = 0; x < coarse.w; x++) {
        const i = y * coarse.w + x;
        if (coarse.cover[i] > 0) continue;
        open++;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= coarse.w || yy >= coarse.h) continue;
            const j = yy * coarse.w + xx;
            if (coarse.cover[j] <= 0) continue;
            r += coarse.red[j];
            g += coarse.green[j];
            b += coarse.blue[j];
            n++;
          }
        }
        if (!n) continue;
        nr[i] = r / n;
        ng[i] = g / n;
        nb[i] = b / n;
        na[i] = 1;
      }
    }
    coarse.red = nr;
    coarse.green = ng;
    coarse.blue = nb;
    coarse.cover = na;
    if (!open) break;
  }

  for (let level = levels.length - 2; level >= 0; level--) {
    const fine = levels[level];
    const parent = levels[level + 1];
    for (let y = 0; y < fine.h; y++) {
      const fy = (y + 0.5) * parent.h / fine.h - 0.5;
      for (let x = 0; x < fine.w; x++) {
        const i = y * fine.w + x;
        if (fine.cover[i] > 0) continue;
        const fx = (x + 0.5) * parent.w / fine.w - 0.5;
        fine.red[i] = samplePlane(parent.red, parent.w, parent.h, fx, fy);
        fine.green[i] = samplePlane(parent.green, parent.w, parent.h, fx, fy);
        fine.blue[i] = samplePlane(parent.blue, parent.w, parent.h, fx, fy);
        fine.cover[i] = 1;
      }
    }
  }

  const base = levels[0];
  const fr = boxBlur(base.red, base.w, base.h, 7);
  const fg = boxBlur(base.green, base.w, base.h, 7);
  const fb = boxBlur(base.blue, base.w, base.h, 7);
  const fm = boxBlur(mask, base.w, base.h, 2);

  // Interior pixels stay as the warp wrote them. Only the holes and a thin
  // band along their edge sample the blurred guess.
  for (let by = 0; by < base.h; by++) {
    const y0 = Math.min(oh - 1, Math.floor(by * oh / base.h));
    let y1 = Math.floor((by + 1) * oh / base.h);
    if (y1 <= y0) y1 = y0 + 1;
    if (y1 > oh) y1 = oh;
    for (let bx = 0; bx < base.w; bx++) {
      const at = (x, y) => mask[y * base.w + x];
      const solid =
        at(bx, by) >= 0.999 &&
        at(Math.min(base.w - 1, bx + 1), by) >= 0.999 &&
        at(Math.max(0, bx - 1), by) >= 0.999 &&
        at(bx, Math.min(base.h - 1, by + 1)) >= 0.999 &&
        at(bx, Math.max(0, by - 1)) >= 0.999;
      if (solid) continue;
      const x0 = Math.min(ow - 1, Math.floor(bx * ow / base.w));
      let x1 = Math.floor((bx + 1) * ow / base.w);
      if (x1 <= x0) x1 = x0 + 1;
      if (x1 > ow) x1 = ow;
      for (let y = y0; y < y1; y++) {
        const fy = (y + 0.5) * base.h / oh - 0.5;
        const row = y * ow;
        for (let x = x0; x < x1; x++) {
          const fx = (x + 0.5) * base.w / ow - 0.5;
          const m = samplePlane(fm, base.w, base.h, fx, fy);
          const i = (row + x) * 4;
          const hole = dst[i + 3] < 16;
          const t = hole ? 0 : m >= 0.82 ? 1 : m <= 0.25 ? 0 : (m - 0.25) / 0.57;
          if (t === 1) continue;
          const r = samplePlane(fr, base.w, base.h, fx, fy);
          const g = samplePlane(fg, base.w, base.h, fx, fy);
          const b = samplePlane(fb, base.w, base.h, fx, fy);
          if (t === 0) {
            dst[i] = r;
            dst[i + 1] = g;
            dst[i + 2] = b;
          } else {
            dst[i] = r + (dst[i] - r) * t;
            dst[i + 1] = g + (dst[i + 1] - g) * t;
            dst[i + 2] = b + (dst[i + 2] - b) * t;
          }
          dst[i + 3] = 255;
        }
      }
    }
  }
}

// A full straighten is worth running when a wall faces the camera: its top
// and bottom edges are nearly level, and its uprights are vertical. Oblique
// two-point listing shots fail this. They only get their verticals made
// upright, from two long verticals, and are left alone when they have none.
//
// The four corners come from the back wall itself. Its baseboard is the level
// edge low in the frame, its sides are the corner uprights at the ends of that
// edge, and its top is the ceiling line across that same span. A window is a
// hole in the baseboard, not a second wall.

const SAMPLE_WIDTH = 420;
const MAX_LEVEL_DEG = 4;
const MIN_LEVEL_SPAN = 0.22;
const MIN_WALL_SEPARATION = 0.2;
const MIN_OVERLAP = 0.12;
const MIN_PAIR_SPAN = 0.3;
const MIN_UPRIGHT_DEG = 78;
const MIN_UPRIGHT_SPAN = 0.18;
const MAX_CORNER_LEAN = 12;
const MIN_CORNER_SPAN = 0.3;
const MIN_CORNER_SEPARATION = 0.3;

function percentile(values, p) {
  const rank = p * (values.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return values[lo] + (values[hi] - values[lo]) * (rank - lo);
}

function lineAngle(theta) {
  let angle = Math.abs(theta - 90);
  if (angle > 90) angle = 180 - angle;
  return angle;
}

function yOn(seg, x) {
  if (Math.abs(seg.s) < 0.15) return seg.y;
  return (seg.rho - x * seg.c) / seg.s;
}

function convex(q) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(z) < 1e-2) return false;
    const s = z > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

// Least-squares line v = a + b * u, refit twice without points farther than
// tol from the previous fit. Returns null when too few points survive.
function fitLine(us, vs, tol) {
  let keep = us.map((_, i) => i);
  let a = 0;
  let b = 0;
  for (let pass = 0; pass < 3; pass++) {
    if (keep.length < 6) return null;
    let su = 0;
    let sv = 0;
    for (const i of keep) {
      su += us[i];
      sv += vs[i];
    }
    const mu = su / keep.length;
    const mv = sv / keep.length;
    let suu = 0;
    let suv = 0;
    for (const i of keep) {
      suu += (us[i] - mu) * (us[i] - mu);
      suv += (us[i] - mu) * (vs[i] - mv);
    }
    b = suu > 1e-6 ? suv / suu : 0;
    a = mv - b * mu;
    keep = keep.filter((i) => Math.abs(vs[i] - (a + b * us[i])) <= tol);
  }
  return keep.length < 6 ? null : { a, b };
}

// The back wall is where the baseboard runs straight. On the side walls it
// slants toward the camera, so the ends of that run are the corners. Each
// edge of the wall is fitted as its own line, so the outline follows any tilt
// in the photo. Returns the four corners in sample pixels, or null.
function traceBackWall(gray, warm, width, height) {
  const blur = new Float32Array(gray.length);
  blur.set(gray);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      blur[i] = (gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] + 4 * gray[i]) / 8;
    }
  }
  const at = (x, y) => blur[y * width + x];
  const median = (vals) => {
    const s = vals.slice().sort((p, q) => p - q);
    return s[s.length >> 1];
  };

  const base = new Int32Array(width).fill(-1);
  const yBase0 = Math.floor(height * 0.55);
  const yBase1 = Math.floor(height * 0.92);
  const xs = [];
  for (let x = 2; x < width - 2; x++) {
    let best = 0;
    let row = -1;
    for (let y = yBase0; y < yBase1; y++) {
      const g = (at(x, Math.min(height - 1, y + 2)) - at(x, Math.max(0, y - 2))) * 0.25;
      if (g > best) {
        best = g;
        row = y;
      }
    }
    if (best > 3.5) {
      base[x] = row;
      xs.push(x);
    }
  }
  if (xs.length < width * 0.08) return null;

  // Strongest near-level line through the baseboard hits. Deterministic
  // pairs keep the result the same on every run.
  const maxSlope = Math.tan((6 * Math.PI) / 180);
  let bestCount = 0;
  let line = null;
  const step = Math.max(1, Math.floor(xs.length / 60));
  for (let i = 0; i < xs.length; i += step) {
    for (let j = i + step; j < xs.length; j += step) {
      const xa = xs[i];
      const xb = xs[j];
      if (xb - xa < width * 0.08) continue;
      const b = (base[xb] - base[xa]) / (xb - xa);
      if (Math.abs(b) > maxSlope) continue;
      const a = base[xa] - b * xa;
      let count = 0;
      for (const x of xs) if (Math.abs(base[x] - (a + b * x)) <= 2) count++;
      if (count > bestCount) {
        bestCount = count;
        line = { a, b };
      }
    }
  }
  if (!line) return null;
  const on = new Uint8Array(width);
  for (const x of xs) on[x] = Math.abs(base[x] - (line.a + line.b * x)) <= 2 ? 1 : 0;

  // Longest run along that line. A window or a vent only interrupts it.
  const gap = Math.floor(width * 0.18);
  let L = -1;
  let R = -1;
  let runL = -1;
  let prev = -1;
  const close = () => {
    if (runL >= 0 && (L < 0 || prev - runL > R - L)) {
      L = runL;
      R = prev;
    }
  };
  for (let x = 0; x < width; x++) {
    if (!on[x]) continue;
    if (runL < 0) runL = x;
    else if (x - prev > gap) {
      close();
      runL = x;
    }
    prev = x;
  }
  close();
  if (L < 0 || R - L < width * 0.18) return null;
  const dense = (x) => {
    let n = 0;
    for (let k = Math.max(0, x - 2); k <= Math.min(width - 1, x + 2); k++) n += on[k];
    return n >= 3;
  };
  while (L < R && !dense(L)) L++;
  while (R > L && !dense(R)) R--;
  if (R - L < width * 0.18) return null;

  // Floor line: where the bright trim gives way to the darker floor. A floor
  // as light as the trim has no such edge, so use the top of the board.
  const topU = [];
  const topV = [];
  const floorU = [];
  const floorV = [];
  for (let x = L; x <= R; x++) {
    if (!on[x]) continue;
    const stop = Math.min(height - 2, base[x] + Math.round(height * 0.035));
    let best = -1;
    let top = base[x];
    for (let y = base[x]; y < stop; y++) {
      if (at(x, y) > best) {
        best = at(x, y);
        top = y;
      }
    }
    topU.push(x);
    topV.push(top);
    let worst = 0;
    let floorRow = -1;
    const end = Math.min(height - 3, top + Math.round(height * 0.09));
    for (let y = top + 1; y < end; y++) {
      const g = (at(x, y + 2) - at(x, y - 2)) * 0.25;
      if (g < worst) {
        worst = g;
        floorRow = y;
      }
    }
    if (worst < -3.5) {
      floorU.push(x);
      floorV.push(floorRow + 1);
    }
  }
  const bottom =
    floorU.length >= topU.length / 2 ? fitLine(floorU, floorV, 1.5) : fitLine(topU, topV, 1.5);
  if (!bottom) return null;

  // Ceiling line: the junction is a thin shadow under a bright ceiling, with
  // wall color below it. Fan blades are too dark to count as wall, and the
  // light is too cool.
  const x0 = L + Math.floor((R - L) * 0.06);
  const x1 = R - Math.floor((R - L) * 0.06);
  const ceilingVals = [];
  const wallVals = [];
  const yWall0 = Math.floor(height * 0.35);
  const yWall1 = Math.floor(bottom.a + bottom.b * ((L + R) / 2) - height * 0.12);
  for (let x = x0; x < x1; x += 2) {
    for (let y = Math.floor(height * 0.04); y < Math.floor(height * 0.12); y++) {
      if (at(x, y) > 140) ceilingVals.push(warm[y * width + x]);
    }
    for (let y = yWall0; y < yWall1; y++) {
      const l = at(x, y);
      if (l > 80 && l < 175) wallVals.push(warm[y * width + x]);
    }
  }
  if (ceilingVals.length < 30 || wallVals.length < 30) return null;
  const ceilingWarm = median(ceilingVals);
  const wallWarm = median(wallVals);
  if (wallWarm - ceilingWarm < 10) return null;
  const mid = (ceilingWarm + wallWarm) / 2;
  const ceilU = [];
  const ceilV = [];
  for (let x = x0; x < x1; x++) {
    const limit = Math.floor(bottom.a + bottom.b * x - height * 0.25);
    for (let y = Math.floor(height * 0.06) + 3; y < limit; y++) {
      const above = (gray[(y - 3) * width + x] + gray[(y - 2) * width + x] + gray[(y - 1) * width + x]) / 3;
      const below = (gray[(y + 1) * width + x] + gray[(y + 2) * width + x]) / 2;
      if (above - below <= 18 || below <= 65) continue;
      let w = 0;
      for (let k = 1; k <= 4; k++) w += warm[(y + k) * width + x];
      if (w / 4 < mid) continue;
      let row = y;
      while (row + 1 < limit && gray[(row + 1) * width + x] < gray[row * width + x]) row++;
      ceilU.push(x);
      ceilV.push(row);
      break;
    }
  }
  const top = fitLine(ceilU, ceilV, 2);
  if (!top) return null;

  // Side lines: the dark crease of each corner, traced row by row.
  const reach = Math.floor(width * 0.025);
  const side = (x) => {
    const us = [];
    const vs = [];
    const yTop = Math.ceil(top.a + top.b * x) + 2;
    const yBot = Math.floor(bottom.a + bottom.b * x) - Math.round(height * 0.06);
    for (let y = yTop; y + 2 < yBot; y += 2) {
      const a = Math.max(2, x - reach);
      const b = Math.min(width - 3, x + reach);
      let xm = a;
      let lo = Infinity;
      const row = [];
      for (let k = a - reach; k <= b + reach; k++) {
        if (k < 0 || k >= width) continue;
        let s = 0;
        for (let d = -1; d <= 1; d++) s += at(Math.max(0, Math.min(width - 1, k + d)), y) + at(Math.max(0, Math.min(width - 1, k + d)), y + 1);
        const v = s / 6;
        row.push(v);
        if (k >= a && k <= b && v < lo) {
          lo = v;
          xm = k;
        }
      }
      if (median(row) - lo > 5) {
        us.push(y);
        vs.push(xm);
      }
    }
    return fitLine(us, vs, 1.5);
  };
  const left = side(L);
  const right = side(R);
  const vertical = (x) => ({ a: x, b: 0 });
  const lineL = left && Math.abs(left.b) < 0.2 ? left : vertical(L);
  const lineR = right && Math.abs(right.b) < 0.2 ? right : vertical(R);

  // Corner where a level line y = a + b x meets an upright x = c + d y.
  const meet = (h, v) => {
    const y = (h.a + h.b * v.a) / (1 - h.b * v.b);
    return { x: v.a + v.b * y, y };
  };
  const quad = [meet(top, lineL), meet(top, lineR), meet(bottom, lineR), meet(bottom, lineL)];
  if (quad[3].y - quad[0].y < height * 0.25 || quad[1].x - quad[0].x < width * 0.18) return null;
  return quad;
}

const SKIP = { ok: false, mode: null, quad: null, lines: null };

// A corner shot has no wall to square up, but its verticals can still be
// made upright. Search near-vertical edges on their own, so floorboards and
// brick cannot crowd them out, then pick two long verticals far apart that
// agree with the rest on where verticals converge. Lines come back as
// [top, bottom] in source pixels.
function pickVerticals(gray, edgeX, edgeY, width, height, sx, sy) {
  const xsV = [];
  const ysV = [];
  for (let i = 0; i < edgeX.length; i++) {
    const k = edgeY[i] * width + edgeX[i];
    const gx = gray[k + 1] - gray[k - 1];
    const gy = gray[k + width] - gray[k - width];
    if (Math.abs(gx) > 2 * Math.abs(gy)) {
      xsV.push(edgeX[i]);
      ysV.push(edgeY[i]);
    }
  }
  if (xsV.length < 40) return SKIP;

  // Each line is indexed by its x at mid-height and its lean, so the same
  // edge seen at a slightly different lean lands in the same cell.
  const midY = height / 2;
  const leans = [];
  for (let d = -MAX_CORNER_LEAN; d <= MAX_CORNER_LEAN + 1e-9; d += 0.5) leans.push(Math.tan((d * Math.PI) / 180));
  const nl = leans.length;
  const cols = width + 1;
  const acc = new Uint32Array(cols * nl);
  for (let i = 0; i < xsV.length; i++) {
    for (let t = 0; t < nl; t++) {
      const xm = Math.round(xsV[i] - (ysV[i] - midY) * leans[t]);
      if (xm >= 0 && xm < cols) acc[xm * nl + t]++;
    }
  }

  const minVotes = Math.max(20, Math.floor(MIN_CORNER_SPAN * height * 0.5));
  const cands = [];
  for (let n = 0; n < 40; n++) {
    let best = 0;
    let at = 0;
    for (let i = 0; i < acc.length; i++) {
      if (acc[i] > best) {
        best = acc[i];
        at = i;
      }
    }
    if (best < minVotes) break;
    const xm = Math.floor(at / nl);
    const t = at - xm * nl;
    for (let dt = -6; dt <= 6; dt++) {
      const tt = t + dt;
      if (tt < 0 || tt >= nl) continue;
      for (let c = Math.max(0, xm - 5); c <= Math.min(cols - 1, xm + 5); c++) acc[c * nl + tt] = 0;
    }
    const sel = [];
    for (let i = 0; i < xsV.length; i++) {
      if (Math.abs(xsV[i] - (xm + (ysV[i] - midY) * leans[t])) <= 1.8) sel.push(i);
    }
    sel.sort((p, q) => ysV[p] - ysV[q]);
    const maxGap = Math.max(8, height * 0.07);
    let a = 0;
    for (let k = 1; k <= sel.length; k++) {
      if (k < sel.length && ysV[sel[k]] - ysV[sel[k - 1]] <= maxGap) continue;
      const run = sel.slice(a, k);
      a = k;
      if (run.length < 12) continue;
      const yLo = ysV[run[0]];
      const yHi = ysV[run[run.length - 1]];
      if (yHi - yLo < MIN_CORNER_SPAN * height) continue;
      let my = 0;
      let mx = 0;
      for (const i of run) {
        my += ysV[i];
        mx += xsV[i];
      }
      my /= run.length;
      mx /= run.length;
      let syy = 0;
      let syx = 0;
      for (const i of run) {
        syy += (ysV[i] - my) ** 2;
        syx += (ysV[i] - my) * (xsV[i] - mx);
      }
      const fb = syy > 1e-6 ? syx / syy : 0;
      const fa = mx - fb * my;
      cands.push({
        top: { x: fa + fb * yLo, y: yLo },
        bottom: { x: fa + fb * yHi, y: yHi },
        length: yHi - yLo,
        fa,
        fb,
      });
    }
  }
  if (cands.length < 2) return SKIP;

  const xMid = (c) => c.fa + c.fb * midY;
  let best = null;
  let bestScore = -1;
  for (let i = 0; i < cands.length; i++) {
    for (let j = i + 1; j < cands.length; j++) {
      const a = cands[i];
      const b = cands[j];
      const sep = Math.abs(xMid(a) - xMid(b));
      if (sep < MIN_CORNER_SEPARATION * width) continue;
      // Lines x = fa + fb * y meet where fa + fb * y agree.
      const parallel = Math.abs(a.fb - b.fb) < 1e-6;
      const vy = parallel ? Infinity : (b.fa - a.fa) / (a.fb - b.fb);
      if (Math.abs(vy - midY) < 1.25 * height) continue;
      const vx = parallel ? 0 : a.fa + a.fb * vy;
      let support = 0;
      for (const c of cands) {
        const want = parallel ? a.fb : (vx - xMid(c)) / (vy - midY);
        if (Math.abs(Math.atan(c.fb) - Math.atan(want)) < (1.5 * Math.PI) / 180) support += c.length;
      }
      const score = support * sep * Math.min(a.length, b.length);
      if (score > bestScore) {
        bestScore = score;
        best = xMid(a) < xMid(b) ? [a, b] : [b, a];
      }
    }
  }
  if (!best) return SKIP;
  const scale = (p) => ({ x: p.x * sx, y: p.y * sy });
  return {
    ok: true,
    mode: "verticals",
    quad: null,
    lines: best.map((c) => [scale(c.top), scale(c.bottom)]),
  };
}

/**
 * @param {CanvasImageSource} image
 * `mode` is the fit to use first. A wall verdict also carries the vertical
 * lines when it found them, so either fit can be shown.
 *
 * @returns {{
 *   ok: boolean,
 *   mode: "wall" | "verticals" | null,
 *   quad: {x: number, y: number}[] | null,
 *   lines: {x: number, y: number}[][] | null,
 * }}
 */
export function assessStraightenCandidate(image) {
  const srcW = image.naturalWidth || image.width;
  const srcH = image.naturalHeight || image.height;
  if (!srcW || !srcH || typeof document === "undefined") return SKIP;

  const width = SAMPLE_WIDTH;
  const height = Math.max(2, Math.round((srcH * width) / srcW));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const gray = new Float32Array(width * height);
  const warm = new Float32Array(width * height);
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    gray[p] = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
    warm[p] = pixels[i] - pixels[i + 2];
  }

  const mag = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx = gray[i + 1] - gray[i - 1];
      const gy = gray[i + width] - gray[i - width];
      mag[i] = Math.hypot(gx, gy);
    }
  }
  const magSorted = Array.from(mag).sort((a, b) => a - b);
  const thresh = Math.max(28, percentile(magSorted, 0.92));
  const edgeX = [];
  const edgeY = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (mag[y * width + x] >= thresh) {
        edgeX.push(x);
        edgeY.push(y);
      }
    }
  }
  if (edgeX.length < 40) return SKIP;

  const step = edgeX.length > 8000 ? Math.ceil(edgeX.length / 8000) : 1;
  const rhoMax = Math.ceil(Math.hypot(width, height)) + 1;
  const rhoCount = rhoMax * 2;
  const acc = new Uint32Array(rhoCount * 180);
  const cos = new Float64Array(180);
  const sin = new Float64Array(180);
  for (let th = 0; th < 180; th++) {
    const rad = (th * Math.PI) / 180;
    cos[th] = Math.cos(rad);
    sin[th] = Math.sin(rad);
  }
  for (let th = 0; th < 180; th++) {
    const c = cos[th];
    const s = sin[th];
    for (let i = 0; i < edgeX.length; i += step) {
      const rho = Math.round(edgeX[i] * c + edgeY[i] * s) + rhoMax;
      acc[rho * 180 + th] += 1;
    }
  }

  const peaks = [];
  for (let n = 0; n < 20; n++) {
    let best = 0;
    let at = 0;
    for (let i = 0; i < acc.length; i++) {
      if (acc[i] > best) {
        best = acc[i];
        at = i;
      }
    }
    if (best < 40) break;
    const r = Math.floor(at / 180);
    const th = at - r * 180;
    peaks.push([r, th]);
    for (let dt = -3; dt <= 3; dt++) {
      const tt = (th + dt + 180) % 180;
      const r0 = Math.max(0, r - 8);
      const r1 = Math.min(rhoCount, r + 9);
      for (let rr = r0; rr < r1; rr++) acc[rr * 180 + tt] = 0;
    }
  }

  const segs = [];
  for (const [r, th] of peaks) {
    const rho = r - rhoMax;
    const c = cos[th];
    const s = sin[th];
    const selX = [];
    const selY = [];
    for (let i = 0; i < edgeX.length; i++) {
      if (Math.abs(edgeX[i] * c + edgeY[i] * s - rho) <= 1.8) {
        selX.push(edgeX[i]);
        selY.push(edgeY[i]);
      }
    }
    if (selX.length < 30) continue;
    const dx = -s;
    const dy = c;
    const order = selX.map((_, i) => i);
    order.sort((a, b) => selX[a] * dx + selY[a] * dy - (selX[b] * dx + selY[b] * dy));
    const t = order.map((i) => selX[i] * dx + selY[i] * dy);
    const bounds = [-1];
    for (let i = 0; i < t.length - 1; i++) {
      if (t[i + 1] - t[i] > 18) bounds.push(i);
    }
    bounds.push(t.length - 1);
    const ang = lineAngle(th);
    for (let k = 0; k < bounds.length - 1; k++) {
      const a = bounds[k] + 1;
      const b = bounds[k + 1];
      if (b - a < 24) continue;
      const x1 = selX[order[a]];
      const y1 = selY[order[a]];
      const x2 = selX[order[b]];
      const y2 = selY[order[b]];
      segs.push({
        ang,
        c,
        s,
        rho,
        length: Math.hypot(x2 - x1, y2 - y1),
        y: (y1 + y2) / 2,
        x0: Math.min(x1, x2),
        x1: Math.max(x1, x2),
        yLo: Math.min(y1, y2),
        yHi: Math.max(y1, y2),
      });
    }
  }

  const level = segs.filter((s) => s.ang <= MAX_LEVEL_DEG && s.length >= MIN_LEVEL_SPAN * width);
  const uprights = segs.filter((s) => s.ang >= MIN_UPRIGHT_DEG && s.length >= MIN_UPRIGHT_SPAN * height);
  const corner = () => pickVerticals(gray, edgeX, edgeY, width, height, srcW / width, srcH / height);
  if (uprights.length < 2) return corner();

  let top = null;
  let bottom = null;
  let bestSep = -1;
  for (let i = 0; i < level.length; i++) {
    for (let j = i + 1; j < level.length; j++) {
      const a = level[i];
      const b = level[j];
      const sep = Math.abs(a.y - b.y);
      if (sep < MIN_WALL_SEPARATION * height) continue;
      const overlap = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const span = Math.max(a.x1, b.x1) - Math.min(a.x0, b.x0);
      if (overlap < MIN_OVERLAP * width || span < MIN_PAIR_SPAN * width) continue;
      if (sep > bestSep) {
        bestSep = sep;
        if (a.y < b.y) {
          top = a;
          bottom = b;
        } else {
          top = b;
          bottom = a;
        }
      }
    }
  }
  if (!bottom) return corner();

  const traced = traceBackWall(gray, warm, width, height);
  const sample = traced || [
    { x: top.x0, y: top.y },
    { x: top.x1, y: yOn(top, top.x1) },
    { x: bottom.x1, y: yOn(bottom, bottom.x1) },
    { x: bottom.x0, y: bottom.y },
  ];
  const sx = srcW / width;
  const sy = srcH / height;
  let quad = sample.map((p) => ({
    x: Math.max(0, Math.min(srcW, p.x * sx)),
    y: Math.max(0, Math.min(srcH, p.y * sy)),
  }));
  if (!convex(quad)) {
    const xs = quad.map((p) => p.x);
    const ys = quad.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(quad[0].y, quad[1].y);
    const maxY = Math.max(quad[2].y, quad[3].y);
    quad = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ];
  }
  return { ok: true, mode: "wall", quad, lines: corner().lines };
}

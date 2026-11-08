"use client";

import { useEffect, useRef } from "react";

const W = 1448;
const H = 1086;
const LINES = [
  [{ x: 65.5, y: 0 }, { x: 172.3, y: 1086 }],
  [{ x: 1225.1, y: 0 }, { x: 1147.9, y: 1086 }],
];

// One loop, in ms: hold as shot, correct while the corners fill, hold filled,
// fade back to as shot.
const HOLD_BEFORE = 1100;
const CORRECT = 2000;
const HOLD_FILLED = 1900;
const FADE = 360;
const LOOP = HOLD_BEFORE + CORRECT + HOLD_FILLED + FADE;

// Corrected photo is shown this much larger, so the generated corners, the
// weakest part of the fill, sit outside the frame.
const ZOOM = 1.05;

// The generated fill is an outpainted border around the photo, in the photo's
// own pixels, so it warps with it. This is where that image sits.
const EXTEND = { x: -126, y: -47, w: 1694, h: 1173 };

// Blur showing around the as-shot photo, in CSS pixels per side.
const PAD = 6;

function mul(m, n) {
  const out = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] = m[r * 3] * n[c] + m[r * 3 + 1] * n[3 + c] + m[r * 3 + 2] * n[6 + c];
    }
  }
  return out;
}

function apply(m, x, y) {
  const w = m[6] * x + m[7] * y + m[8];
  return { x: (m[0] * x + m[1] * y + m[2]) / w, y: (m[3] * x + m[4] * y + m[5]) / w };
}

function cross(u, v) {
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
}

// Vertical vanishing point of the two lines, centered on the photo, as in
// straightenVerticals in src/lib/perspective.js.
const VANISH = (() => {
  const h = (p) => [p.x - W / 2, p.y - H / 2, 1];
  const [a, b] = LINES.map(([top, bottom]) => cross(h(top), h(bottom)));
  const v = cross(a, b);
  return { x: v[0] / v[2], y: v[1] / v[2] };
})();

// The correction at strength t, from 0 (as shot) to 1 (verticals upright),
// about the center of the photo. `inset` is the scale of the as-shot photo,
// just under 1 so a band of blur frames it before the correction starts.
function correction(t, inset) {
  const P = [1, 0, 0, 0, 1, 0, 0, -t / VANISH.y, 1];
  const S = [1, (-t * VANISH.x) / VANISH.y, 0, 0, 1, 0, 0, 0, 1];
  const T = [1, 0, -W / 2, 0, 1, -H / 2, 0, 0, 1];
  const Ti = [1, 0, W / 2, 0, 1, H / 2, 0, 0, 1];
  const M = mul(Ti, mul(S, mul(P, T)));
  // Shrink to keep the whole warped photo in frame, so no edge is cropped.
  const pts = [
    [0, 0],
    [W, 0],
    [W, H],
    [0, H],
  ].map(([x, y]) => apply(M, x, y));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min(W / (maxX - minX), H / (maxY - minY)) * (inset + (ZOOM - inset) * t);
  const F = [s, 0, (W - s * (minX + maxX)) / 2, 0, s, (H - s * (minY + maxY)) / 2, 0, 0, 1];
  return mul(F, M);
}

// Image pixels to element pixels, as a CSS matrix3d with origin top left.
function css(m, kx, ky) {
  const [a, b, c, d, e, f, g, h, i] = [m[0], (m[1] * kx) / ky, m[2] * kx, (m[3] * ky) / kx, m[4], m[5] * ky, m[6] / kx, m[7] / ky, m[8]];
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${h},0,0,1,0,${c},${f},0,${i})`;
}

function ease(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

// Correction strength, how far the filled corners have faded in, and how far
// the as-shot photo has faded back in over both.
function stateAt(ms) {
  const now = ms % LOOP;
  const clamp = (x) => Math.min(1, Math.max(0, x));
  const t = ease(clamp((now - HOLD_BEFORE) / CORRECT));
  return { t, fill: t, back: clamp((now - HOLD_BEFORE - CORRECT - HOLD_FILLED) / FADE) };
}

export default function DistortionDemo() {
  const frame = useRef(null);
  const layer = useRef(null);
  const filled = useRef(null);
  const asShot = useRef(null);
  const asShotPhoto = useRef(null);

  useEffect(() => {
    const paint = ({ t, fill, back }) => {
      const { clientWidth, clientHeight } = frame.current;
      const inset = 1 - (2 * PAD) / clientWidth;
      layer.current.style.transform = css(correction(t, inset), clientWidth / W, clientHeight / H);
      asShotPhoto.current.style.transform = `scale(${inset})`;
      filled.current.style.opacity = String(fill);
      asShot.current.style.opacity = String(back);
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const resize = () => paint({ t: 1, fill: 1, back: 0 });
      resize();
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }

    let raf = 0;
    let start = 0;
    const tick = (now) => {
      start ||= now;
      paint(stateAt(now - start));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={frame} className="relative aspect-[4/3] overflow-hidden rounded-xl border-[3px] border-ink shadow-[5px_5px_0_0_#1a1a1a]">
      <img className="absolute inset-0 block h-full w-full scale-110 blur-xl" src="/examples/wyandotte-kitchen.webp" alt="" aria-hidden="true" />
      <div ref={layer} className="absolute inset-0 origin-top-left will-change-transform">
        <img
          className="block h-full w-full"
          src="/examples/wyandotte-kitchen.webp"
          alt="Kitchen shot on a wide lens. The cabinets and the doorway lean, then straighten as the camera distortion is corrected"
        />
        <img
          ref={filled}
          className="absolute block max-w-none opacity-0"
          style={{
            left: `${(EXTEND.x / W) * 100}%`,
            top: `${(EXTEND.y / H) * 100}%`,
            width: `${(EXTEND.w / W) * 100}%`,
            height: `${(EXTEND.h / H) * 100}%`,
          }}
          src="/examples/wyandotte-kitchen-fill.webp"
          alt=""
          aria-hidden="true"
        />
      </div>
      <div ref={asShot} className="absolute inset-0 opacity-0" aria-hidden="true">
        <img className="absolute inset-0 block h-full w-full scale-110 blur-xl" src="/examples/wyandotte-kitchen.webp" alt="" />
        <img ref={asShotPhoto} className="absolute inset-0 block h-full w-full" src="/examples/wyandotte-kitchen.webp" alt="" />
      </div>
    </div>
  );
}

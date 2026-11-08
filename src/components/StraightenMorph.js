"use client";

import { useLayoutEffect, useRef } from "react";
import { quadHomography } from "@/lib/perspective";

const MORPH_MS = 650;
// Longest edge of the animated copy; plenty for a moving picture.
const MAX_EDGE = 1600;

function ease(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

// Canvas pixels to element pixels, as a CSS matrix3d with origin top left.
function css(m) {
  return `matrix3d(${m[0]},${m[3]},0,${m[6]},${m[1]},${m[4]},0,${m[7]},0,0,1,0,${m[2]},${m[5]},0,${m[8]})`;
}

/**
 * Over the stage, eases the photo's corners from `from` to `to` (fractions of
 * the stage), over the finished render and its filled edges. `image` must
 * already be loaded, so the first frame shows the photo.
 */
export default function StraightenMorph({ image, from, to, onDone }) {
  const frame = useRef(null);
  const photo = useRef(null);
  const done = useRef(onDone);
  done.current = onDone;

  useLayoutEffect(() => {
    const canvas = photo.current;
    const s = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.round(image.naturalWidth * s);
    canvas.height = Math.round(image.naturalHeight * s);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const corners = [
      { x: 0, y: 0 },
      { x: canvas.width, y: 0 },
      { x: canvas.width, y: canvas.height },
      { x: 0, y: canvas.height },
    ];
    const paint = (elapsed) => {
      const t = ease(Math.min(1, elapsed / MORPH_MS));
      const { clientWidth: w, clientHeight: h } = frame.current;
      const at = from.map((a, i) => ({
        x: (a.x + (to[i].x - a.x) * t) * w,
        y: (a.y + (to[i].y - a.y) * t) * h,
      }));
      const m = quadHomography(corners, at);
      if (m) canvas.style.transform = css(m);
    };
    let raf = 0;
    let start = 0;
    const tick = (now) => {
      start ||= now;
      paint(now - start);
      if (now - start >= MORPH_MS) return done.current();
      raf = requestAnimationFrame(tick);
    };
    paint(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [image, from, to]);

  return (
    <div ref={frame} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <canvas ref={photo} className="absolute top-0 left-0 block max-w-none origin-top-left will-change-transform" />
    </div>
  );
}

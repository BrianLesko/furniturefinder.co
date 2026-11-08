"use client";

import { useEffect, useRef, useState } from "react";

const ANGLES = ["one-quarter", "front", "three-quarter"];

const PIECES = [
  { slug: "kivik-sofa", name: "KIVIK sofa" },
  { slug: "lohals-rug", name: "LOHALS rug" },
  { slug: "vaila-table", name: "Vaila oak table" },
  { slug: "maison-stool", name: "Maison leather stool" },
];

const ANGLE_LABEL = {
  "one-quarter": "one-quarter view",
  front: "front view",
  "three-quarter": "three-quarter view",
};

const STEP_MS = 1000;

function angleAt(step, index) {
  if (step < 0) return "front";
  const active = Math.floor(step / ANGLES.length) % PIECES.length;
  const frame = step % ANGLES.length;
  const finished = step >= (index + 1) * ANGLES.length;
  if (index === active) return ANGLES[frame];
  if (finished) return "three-quarter";
  return "front";
}

function samePicture(a, b) {
  return PIECES.every((_, index) => angleAt(a, index) === angleAt(b, index));
}

// 640px WebPs of the product photos. The studio still uses the full PNGs.
function srcFor(slug, angle) {
  return `/spin/${slug}-${angle}.webp`;
}

function Frame({ src, alt }) {
  const [shown, setShown] = useState(src);

  useEffect(() => {
    if (src === shown) return undefined;
    let cancel = false;
    const next = new Image();
    next.onload = () => {
      if (!cancel) setShown(src);
    };
    next.src = src;
    return () => {
      cancel = true;
    };
  }, [src, shown]);

  return (
    <img
      className="block aspect-[4/3] w-full rounded-lg bg-cream object-contain"
      src={shown}
      alt={alt}
      width={640}
      height={480}
    />
  );
}

export default function ProductSpin() {
  const rootRef = useRef(null);
  const [near, setNear] = useState(false);
  const [step, setStep] = useState(-1);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver !== "function") {
      setNear(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!near || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const id = setInterval(() => {
      setStep((current) => {
        let next = current + 1;
        while (samePicture(current, next)) next += 1;
        return next;
      });
    }, STEP_MS);
    return () => clearInterval(id);
  }, [near]);

  return (
    <div ref={rootRef} className="grid grid-cols-2 gap-2 overflow-hidden rounded-xl border-[3px] border-ink bg-white p-2 shadow-[5px_5px_0_0_#1a1a1a] md:order-1">
      {PIECES.map((piece, index) => {
        const angle = angleAt(step, index);
        return near ? (
          <Frame key={piece.slug} src={srcFor(piece.slug, angle)} alt={`${piece.name}, ${ANGLE_LABEL[angle]}`} />
        ) : (
          <div className="aspect-[4/3] w-full rounded-lg bg-cream" key={piece.slug} />
        );
      })}
    </div>
  );
}

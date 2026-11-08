"use client";

import { useEffect, useId, useRef, useState } from "react";

const sofa = (
  <>
    <ellipse cx="100" cy="104" rx="72" ry="4" fill="#1a1a1a" opacity="0.12" />
    <rect x="48" y="96" width="14" height="7" rx="1.5" fill="#3a2418" />
    <rect x="138" y="96" width="14" height="7" rx="1.5" fill="#3a2418" />
    <path fill="#6b4630" d="M42 88h116c6 0 8 2.5 8 6s-2 6-8 6H42c-6 0-8-2.5-8-6s2-6 8-6z" />
    <rect x="14" y="50" width="48" height="44" rx="22" fill="#e45436" />
    <rect x="20" y="56" width="36" height="32" rx="16" fill="#ff6b4a" />
    <rect x="138" y="50" width="48" height="44" rx="22" fill="#e45436" />
    <rect x="144" y="56" width="36" height="32" rx="16" fill="#ff6b4a" />
    <path fill="#ff6b4a" d="M48 44c0-16 12-26 30-26h44c18 0 30 10 30 26v30H48V44z" />
    <path fill="#ff8d74" d="M70 22H90A6 6 0 0 1 96 28V52A6 6 0 0 1 90 58H70A14 14 0 0 1 56 44V36A14 14 0 0 1 70 22Z" />
    <path fill="#ff8d74" d="M110 22H130A14 14 0 0 1 144 36V44A14 14 0 0 1 130 58H110A6 6 0 0 1 104 52V28A6 6 0 0 1 110 22Z" />
    <path fill="#e45436" d="M46 68h108v14c0 6-6 10-14 10H60c-8 0-14-4-14-10V68z" />
    <rect x="54" y="70" width="42" height="16" rx="5" fill="#ff7a58" />
    <rect x="104" y="70" width="42" height="16" rx="5" fill="#ff7a58" />
  </>
);

const couch = (
  <svg x="2" y="16" width="36" height="20.2" viewBox="0 0 200 112">
    {sofa}
  </svg>
);

// .mark-zoom in globals.css must translate by the inverse of .mark-lens so the zoomed copy stays aligned.
const ZOOM = 1.6;
const LENS = { x: 26.5, y: 18.5 };

export default function Mark({ size = 40 }) {
  const id = useId();
  const ref = useRef(null);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    const target = ref.current.closest("a") ?? ref.current;
    function spin(event) {
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setSpinning(true);
      if (target.pathname === window.location.pathname) {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
    target.addEventListener("click", spin);
    return () => target.removeEventListener("click", spin);
  }, []);

  return (
    <svg
      ref={ref}
      className={spinning ? "mark mark-spin" : "mark"}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      onAnimationEnd={(event) => event.target.classList.contains("mark-lens") && setSpinning(false)}
    >
      <defs>
        <clipPath id={`${id}-lens`}>
          <circle cx={LENS.x} cy={LENS.y} r="6.4" />
        </clipPath>
        <radialGradient id={`${id}-glass`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#bfe3ff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#4a9bd9" stopOpacity="0.25" />
        </radialGradient>
      </defs>
      {couch}
      <g className="mark-lens">
        <g clipPath={`url(#${id}-lens)`}>
          <rect x={LENS.x - 7} y={LENS.y - 7} width="14" height="14" fill="var(--mark-bg, #fdf8d8)" />
          <g transform={`translate(${(1 - ZOOM) * LENS.x} ${(1 - ZOOM) * LENS.y}) scale(${ZOOM})`}>
            <g className="mark-zoom">{couch}</g>
          </g>
          <circle cx={LENS.x} cy={LENS.y} r="7.2" fill={`url(#${id}-glass)`} />
          <path d="M22.3 16.4a4.8 4.8 0 0 1 3.4-3.2" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.85" />
        </g>
        <g fill="none" stroke="var(--mark-ink, #1a1a1a)" strokeWidth="1.6" strokeLinecap="round">
          <circle cx={LENS.x} cy={LENS.y} r="7.2" />
          <path d="M31.3 23.8 L35.5 28.5" />
        </g>
      </g>
    </svg>
  );
}

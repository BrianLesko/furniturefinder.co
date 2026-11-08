"use client";

import { useEffect, useRef, useState } from "react";

// The fade finishes before hover and press styles are allowed to move, so a
// cursor already over the button does not play the press as it appears.
export default function HeroCtaRow({ className = "", style, children }) {
  const ref = useRef(null);
  const [phase, setPhase] = useState("hold");

  useEffect(() => {
    const el = ref.current;
    let frame = 0;
    const settle = () => {
      setPhase("snap");
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setPhase("live"));
      });
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      settle();
      return () => cancelAnimationFrame(frame);
    }
    const onEnd = (event) => {
      if (event.target === el && event.animationName === "hero-fade") settle();
    };
    el.addEventListener("animationend", onEnd);
    if (el.getAnimations?.().some((anim) => anim.animationName === "hero-fade" && anim.playState === "finished")) settle();
    return () => {
      el.removeEventListener("animationend", onEnd);
      cancelAnimationFrame(frame);
    };
  }, []);

  const phaseClass = phase === "live" ? "" : phase === "snap" ? "hero-cta-snap" : "hero-cta-hold";
  return (
    <div ref={ref} className={`${className} ${phaseClass}`} style={style}>
      {children}
    </div>
  );
}

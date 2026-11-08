"use client";

import { useEffect, useState } from "react";

const press =
  "inline-flex items-center justify-center rounded-full border-ink font-bold no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#1a1a1a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none";

// Same moment as textwork.co: the corner button fades in once the hero has scrolled away.
const SHOW_AFTER = 400;

export default function StickyStart() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > SHOW_AFTER);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed top-6 right-6 z-50 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:top-7 md:right-8 ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-4 opacity-0"
      }`}
    >
      <a
        className={`${press} border-[3px] bg-hot px-[18px] py-2 font-display text-lg text-white`}
        href="/studio"
        tabIndex={show ? undefined : -1}
        aria-hidden={show ? undefined : true}
      >
        Start now
      </a>
    </div>
  );
}

"use client";

import { useState } from "react";
import { FAQ } from "@/content/faq";

export default function Faq({ items = FAQ }) {
  const [open, setOpen] = useState(0);

  return (
    <div className="overflow-hidden rounded-xl border-[3px] border-ink bg-white shadow-[5px_5px_0_0_#1a1a1a]">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div className={i === items.length - 1 ? "" : "border-b-2 border-ink/10"} key={item.q}>
            <button
              type="button"
              className="flex w-full cursor-pointer items-start justify-between gap-4 px-5 py-5 text-left text-sm font-bold text-ink transition-colors hover:bg-yellow/20 hover:text-hot"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              {item.q}
              <svg className={`mt-0.5 h-4 w-4 shrink-0 ${isOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M11.9999 13.1714L16.9497 8.22168L18.3639 9.63589L11.9999 15.9999L5.63599 9.63589L7.0502 8.22168L11.9999 13.1714Z" />
              </svg>
            </button>
            {isOpen ? <p className="m-0 px-5 pb-5 text-sm leading-relaxed text-ink/80">{item.a}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

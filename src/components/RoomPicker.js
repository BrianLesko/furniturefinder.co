"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const when = (iso) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function Thumb({ src, alt }) {
  if (!src) {
    return (
      <span className="grid h-9 w-12 shrink-0 place-items-center rounded-[20px] border-2 border-ink bg-cream text-ink/50" aria-hidden="true">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
          <path d="M4 10.5 12 4l8 6.5V20H4z" />
          <path d="M10 20v-6h4v6" />
        </svg>
      </span>
    );
  }
  return <img className="h-9 w-12 shrink-0 rounded-[20px] border-2 border-ink object-cover" src={src} alt={alt} />;
}

// The saved-room switcher above the dashboard studio, laid out like the
// company switcher: the current room on the left, the list under it.
export default function RoomPicker({ rooms = [], currentId = null }) {
  const saved = useMemo(() => rooms.filter((room) => room.editable), [rooms]);
  const current = saved.find((room) => room.id === currentId) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return saved.filter((room) => {
      const text = `${room.title} ${room.names.join(" ")}`.toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [saved, query]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="flex max-w-full cursor-pointer items-center gap-2 rounded-full border-[3px] border-ink bg-white py-1 pr-3 pl-1 text-left shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_0_#1a1a1a]"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          setQuery("");
        }}
      >
        <Thumb src={current ? `/api/scenes/${current.id}/mockup` : null} alt="" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">{current ? current.title : "New room"}</span>
          <span className="block truncate font-mono text-[11px] text-ink/60">
            {current
              ? `${current.pieces} ${current.pieces === 1 ? "piece" : "pieces"} · ${when(current.savedAt)}`
              : "Nothing saved yet"}
          </span>
        </span>
        <svg className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div className="absolute top-full left-0 z-40 mt-2 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border-[3px] border-ink bg-white shadow-[6px_6px_0_0_#1a1a1a]">
          {saved.length > 4 ? (
            <label className="flex items-center gap-2 border-b-[3px] border-ink px-3 py-2">
              <svg className="h-4 w-4 shrink-0 text-ink/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4.5 4.5" />
              </svg>
              <input
                className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:font-normal placeholder:text-ink/50"
                type="search"
                placeholder="Search rooms"
                aria-label="Search rooms"
                value={query}
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          ) : null}
          <ul className="m-0 max-h-80 list-none overflow-auto p-1.5" role="listbox" aria-label="Rooms">
            <li>
              <a
                className={`flex items-center gap-2 rounded-xl px-2 py-1.5 no-underline ${current ? "hover:bg-cream" : "bg-blush"}`}
                href="/dashboard#studio"
                role="option"
                aria-selected={!current}
                onClick={() => setOpen(false)}
              >
                <Thumb src={null} alt="" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold">New room</span>
                  <span className="block font-mono text-[11px] text-ink/60">Start from a photo</span>
                </span>
              </a>
            </li>
            {matches.map((room) => (
              <li key={room.id}>
                <a
                  className={`flex items-center gap-2 rounded-xl px-2 py-1.5 no-underline hover:bg-cream ${room.id === currentId ? "bg-blush" : ""}`}
                  href={`/dashboard?scene=${room.id}#studio`}
                  role="option"
                  aria-selected={room.id === currentId}
                  onClick={() => setOpen(false)}
                >
                  <Thumb src={`/api/scenes/${room.id}/mockup`} alt="" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{room.title}</span>
                    <span className="block truncate font-mono text-[11px] text-ink/60">
                      {room.pieces} {room.pieces === 1 ? "piece" : "pieces"}
                      {room.names.length ? ` · ${room.names.join(", ")}` : ""} · {when(room.savedAt)}
                    </span>
                  </span>
                </a>
              </li>
            ))}
            {!matches.length && query ? (
              <li className="px-3 py-4 text-center font-mono text-[12px] text-ink/60">No rooms match “{query.trim()}”.</li>
            ) : null}
            {!saved.length ? (
              <li className="px-3 py-4 text-center font-mono text-[12px] text-ink/60">
                Saved rooms show up here. Save one from the Render step.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

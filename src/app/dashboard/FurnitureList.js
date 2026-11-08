"use client";

import { useMemo, useState } from "react";
import Chip from "@/components/Chip";
import { ROOM_TYPES } from "@/lib/room-type";

function inches(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  const rounded = Math.round(number * 1000) / 1000;
  return String(rounded);
}

export default function FurnitureList({ headingClass, note, roomType, guessingRoom, onRoom, products, counts, ready, onAdd, onCustom }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const pool = guessingRoom ? [] : roomType ? products.filter((product) => product.room === roomType) : products;
    return pool.filter((product) => {
      const text = `${product.name} ${product.category} ${product.room} ${product.sellerName}`.toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [products, query, roomType, guessingRoom]);

  return (
    <>
      <div className="shrink-0 border-b-[3px] border-ink px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 id="furniture-title" className={`${headingClass} shrink-0 whitespace-nowrap`}>
            Furniture
          </h2>
          <label className="ml-auto flex w-56 shrink-0 items-center gap-2 rounded-full border-2 border-ink bg-white px-3 py-1.5 transition-[width] duration-300 ease-out hover:w-72 focus-within:w-72">
            <svg className="h-4 w-4 shrink-0 text-ink/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              className="min-w-0 flex-1 appearance-none bg-transparent px-0 text-sm font-bold outline-none placeholder:font-normal placeholder:text-ink/50"
              type="search"
              placeholder="Search furniture"
              aria-label="Search furniture"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        {note ? <p className="mt-2 mb-0 font-mono text-[12px] text-ink/60">{note}</p> : null}
        <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Room type">
          {ROOM_TYPES.map((type) => (
            <Chip key={type.id} pressed={roomType === type.id} onClick={() => onRoom(type.id)}>
              {type.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col bg-white">
      <ul className="m-0 flex min-h-0 flex-1 list-none flex-col gap-1.5 overflow-y-auto p-2">
        {matches.map((product) => {
          const count = counts.get(product.id) ?? 0;
          return (
            <li key={product.id}>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl border-2 border-transparent bg-white px-2 py-1.5 text-left hover:border-ink hover:bg-cream disabled:cursor-default disabled:opacity-50"
                disabled={!ready}
                onClick={() => onAdd(product)}
              >
                <img className="h-12 w-16 shrink-0 object-contain" src={product.photos[0]?.path} alt="" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{product.name}</span>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-ink/60">
                    {inches(product.widthIn)}″ W × {inches(product.heightIn)}″ H × {inches(product.depthIn)}″ D
                    {count ? ` · ${count} in the photo` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {matches.length === 0 ? (
          <li className="px-2 py-4 text-center font-mono text-[12px] text-ink/60">
            {guessingRoom ? "Looking at the photo…" : query ? `Nothing matches “${query}”.` : "No pieces for this room yet."}
          </li>
        ) : null}
      </ul>
      <button
        type="button"
        className="flex w-full shrink-0 cursor-pointer items-center gap-3 border-t-[3px] border-ink bg-cream px-4 py-3 text-left text-sm font-bold hover:bg-yellow"
        onClick={onCustom}
      >
        <span className="grid h-9 w-12 shrink-0 place-items-center">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        Custom piece
      </button>
      </div>
    </>
  );
}

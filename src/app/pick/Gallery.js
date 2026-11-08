"use client";

import { useState } from "react";

function formatMoney(cents) {
  const hasCents = cents % 100 !== 0;
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  });
}

function formatQuote(product) {
  const low = formatMoney(product.priceCents);
  if (product.priceMaxCents && product.priceMaxCents !== product.priceCents) {
    return `${low}–${formatMoney(product.priceMaxCents)}`;
  }
  return low;
}

function formatQuotedOn(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const ROOMS = [
  { id: "living", label: "Living room" },
  { id: "kitchen", label: "Kitchen" },
  { id: "bedroom", label: "Bedroom" },
];

function matchesQuery(product, query) {
  if (!query) return true;
  const room = ROOMS.find((item) => item.id === product.room)?.label ?? "";
  return `${product.name} ${product.sellerName} ${product.category} ${room}`.toLowerCase().includes(query);
}

function formatInches(value) {
  const number = Number(value);
  const whole = Math.floor(number + 1e-6);
  const fraction = number - whole;
  const fractions = [
    [0, ""],
    [0.125, "1/8"],
    [0.25, "1/4"],
    [0.375, "3/8"],
    [0.5, "1/2"],
    [0.625, "5/8"],
    [0.75, "3/4"],
    [0.875, "7/8"],
  ];
  const match = fractions.find(([amount]) => Math.abs(fraction - amount) < 0.01);
  if (!match) return String(number);
  if (!match[1]) return String(whole);
  return whole ? `${whole} ${match[1]}` : match[1];
}

const DEFAULT_COUNT = 4;

const GALLERY_ANGLES = ["front", "one-quarter", "three-quarter"];

// Photos come lowest altitude first; the gallery shows one per angle.
function galleryPhotos(product) {
  const seen = new Set();
  return product.photos.filter((photo) => {
    if (!GALLERY_ANGLES.includes(photo.angle) || seen.has(photo.angle)) return false;
    seen.add(photo.angle);
    return true;
  });
}

const chip =
  "rounded-full border-2 border-ink px-3.5 py-1.5 text-sm font-bold shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_0_#1a1a1a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";

export default function Gallery({ products }) {
  const [selectedId, setSelectedId] = useState(null);
  const [room, setRoom] = useState(null);
  const [query, setQuery] = useState("");
  const selected = products.find((product) => product.id === selectedId) ?? null;
  const needle = query.trim().toLowerCase();
  const pool = room
    ? products.filter((product) => product.room === room)
    : needle
      ? products
      : products.slice(0, DEFAULT_COUNT);
  const visible = pool.filter((product) => matchesQuery(product, needle));
  const filters = ROOMS;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div role="group" aria-label="Filter by room" className="flex flex-wrap gap-2">
          {filters.map((filter) => {
            const active = room === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={active}
                onClick={() => setRoom(active ? null : filter.id)}
                className={`${chip} ${active ? "bg-hot text-white" : "bg-white"}`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <label className="relative basis-full sm:ml-auto sm:basis-auto">
          <span className="sr-only">Search pieces by name or seller</span>
          <svg className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or seller"
            className="w-full rounded-full border-2 border-ink bg-white py-1.5 pr-4 pl-10 text-sm shadow-[3px_3px_0_0_#1a1a1a] outline-none placeholder:text-ink/40 focus:bg-yellow sm:w-56 [&::-webkit-search-decoration]:appearance-none"
          />
        </label>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={`flex flex-wrap items-center justify-between gap-3 rounded-[22px] border-[3px] border-ink px-5 py-4 shadow-[6px_6px_0_0_#1a1a1a] ${selected ? "bg-blush" : "bg-yellow"}`}
      >
        {selected ? (
          <a
            className={`${chip} order-last bg-white no-underline`}
            href={`/studio?add=${selected.id}`}
          >
            Place it in a room
          </a>
        ) : null}
        <p className="m-0 font-note text-[1.8rem] leading-tight">
          {selected ? (
            <>
              Selected: <span className="font-display text-[1.6rem] tracking-[0.03em] text-hot uppercase">{selected.name}</span>
            </>
          ) : (
            "Click a piece to select it."
          )}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 mb-0 font-note text-[1.6rem] leading-tight">Nothing matches that filter.</p>
      ) : (
        <ul className="mt-6 grid list-none grid-cols-1 items-stretch gap-5 p-0 md:grid-cols-2">
        {visible.map((product) => {
          const isSelected = product.id === selectedId;
          return (
            <li key={product.id} className="flex">
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedId(product.id)}
                className={`flex w-full flex-1 flex-col overflow-hidden rounded-[22px] border-[3px] bg-white text-left ${
                  isSelected
                    ? "border-hot shadow-[6px_6px_0_0_#ff6b4a]"
                    : "border-ink shadow-[6px_6px_0_0_#1a1a1a]"
                }`}
              >
                <figure className="pick-gallery">
                  {galleryPhotos(product).map((photo) => (
                    <img
                      key={photo.angle}
                      src={photo.path}
                      alt={`${product.name}, ${photo.angle} view`}
                      width={800}
                      height={600}
                      draggable={false}
                    />
                  ))}
                  <span className="pick-zones" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                </figure>
                <div className="flex flex-1 items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <h2 className="m-0 min-h-[3lh] font-display text-[1.7rem] leading-none tracking-[0.02em]">{product.name}</h2>
                    <p className="mt-1.5 mb-0 min-h-[2lh] text-xs font-bold tracking-[0.08em] text-ink/60 uppercase">
                      {product.category} · {product.sellerName}
                    </p>
                    <p className="mt-1.5 mb-0 text-sm">
                      {formatInches(product.widthIn)}″ W × {formatInches(product.heightIn)}″ H × {formatInches(product.depthIn)}″ D
                    </p>
                    <p className={`mt-1.5 mb-0 font-display text-lg text-hot ${isSelected ? "" : "invisible"}`}>Selected</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="m-0 font-display text-[1.7rem] leading-none tracking-[0.02em] whitespace-nowrap">{formatQuote(product)}</p>
                    <p className={`mt-1 mb-0 text-xs whitespace-nowrap ${product.compareAtCents ? "text-ink/50 line-through" : "invisible"}`}>
                      {product.compareAtCents ? formatMoney(product.compareAtCents) : "$0"}
                    </p>
                    <p className="mt-1 mb-0 text-xs text-ink/60 whitespace-nowrap">Pulled {formatQuotedOn(product.quotedOn)}</p>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
        </ul>
      )}
    </div>
  );
}

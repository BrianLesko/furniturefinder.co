"use client";

import { useState } from "react";
import { rooms as ROOMS } from "@/content/rooms";

function Chevron({ direction }) {
  const d = direction === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7";
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export default function RoomPair() {
  const [index, setIndex] = useState(0);
  const room = ROOMS[index];
  const step = (delta) => setIndex((current) => (current + delta + ROOMS.length) % ROOMS.length);

  return (
    <section className="mx-auto w-full max-w-[1120px] px-5 pt-16 pb-32 max-md:pt-10 max-md:pb-20" id="rooms">
      <h2 className="m-0 mb-8 text-center font-display text-[clamp(2rem,5vw,3.2rem)] leading-[0.95] tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:1.5px_#1a1a1a] [paint-order:stroke_fill]">
        Before and after
      </h2>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button type="button" className="grid h-[22px] w-[22px] place-items-center border-0 bg-transparent p-0 text-hot" aria-label="Previous room" onClick={() => step(-1)}>
            <Chevron direction="left" />
          </button>
          <p className="m-0 font-display text-xl tracking-[0.04em] text-hot uppercase md:text-2xl">{room.title}</p>
          <button type="button" className="grid h-[22px] w-[22px] place-items-center border-0 bg-transparent p-0 text-hot" aria-label="Next room" onClick={() => step(1)}>
            <Chevron direction="right" />
          </button>
        </div>
        <div className="flex gap-2">
          {ROOMS.map((item, i) => (
            <button
              key={item.title}
              type="button"
              className={`h-[19.25px] rounded-full border-2 border-ink p-0 transition-[width,background-color] duration-200 ${i === index ? "w-[46px] bg-hot" : "w-[19.25px] bg-transparent"}`}
              aria-label={item.title}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      </div>
      <div className="room-in" key={room.title}>
        <div className="grid grid-cols-1 items-center gap-[18px] py-3 pb-5 md:grid-cols-[1fr_auto_1fr]">
          <figure className="mx-[13.333px] overflow-hidden rounded-[28px] border-[3px] border-ink bg-white shadow-[8px_8px_0_0_#1a1a1a]">
            <div className="aspect-[4/3] bg-cream">
              <img className="block h-full w-full object-cover" src={room.before} alt={room.beforeAlt} />
            </div>
            <figcaption className="flex justify-between px-4 py-2.5 font-mono text-[13px]">
              <span className="font-bold">Empty</span>
              <span className="text-ink/55">{room.place}</span>
            </figcaption>
          </figure>
          <svg className="mx-auto h-[36.8px] w-[36.8px] rotate-90 text-hot md:rotate-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <figure className="mx-[13.333px] overflow-hidden rounded-[28px] border-[3px] border-ink bg-white shadow-[8px_8px_0_0_#1a1a1a]">
            <div className="aspect-[4/3] bg-cream">
              <img className="block h-full w-full object-cover" src={room.after} alt={room.afterAlt} />
            </div>
            <figcaption className="flex justify-between px-4 py-2.5 font-mono text-[13px]">
              <span className="font-bold">Furnished</span>
              <span className="text-ink/55">{room.place}</span>
            </figcaption>
          </figure>
        </div>
        <p className="m-0 pt-2 text-center text-sm">
          <a className="font-bold text-ink underline decoration-hot underline-offset-4" href={`/rooms/${room.slug}`}>
            {room.h1}
          </a>
        </p>
        <div className="m-0 grid grid-cols-1 gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          {room.pieces.map(([name, note]) => (
            <div className="rounded-2xl border-[3px] border-ink bg-white px-3.5 py-3" key={name}>
              <b className="block font-display text-[1.2rem] font-normal">{name}</b>
              <span className="text-xs text-ink/60">{note}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

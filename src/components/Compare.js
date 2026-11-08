"use client";

import { useEffect, useState } from "react";

// The heading types these out, the way datafa.st cycles "Google Analytics?",
// "PostHog?", and the rest. Each one lines up with a card below.
const ALTERNATIVES = [
  {
    name: "Photoshop?",
    title: "Photoshop",
    href: "/blog/furniture-finder-vs-photoshop",
    points: [
      ["$12 a month", "A subscription, plus the hours you spend in it"],
      ["Minutes a room", "An hour or more of masking"],
      ["Real listings, with a price", "Cutouts you have to go and find"],
      ["On the floor, at the room's scale", "Placed by eye"],
      ["Drag four corners", "Perspective, masking, and shadows"],
    ],
  },
  {
    name: "a staging crew?",
    title: "A staging crew",
    href: "/blog/furniture-finder-vs-home-staging",
    points: [
      ["$12 a month", "Furniture rental, movers, and a reshoot"],
      ["Minutes", "Days, once the move is scheduled"],
      ["Pieces you can buy", "Whatever was rented for the shoot"],
      ["The listing photo you already have", "A second shoot of the same room"],
    ],
  },
  {
    name: "virtual staging?",
    title: "Virtual staging",
    href: "/blog/furniture-finder-vs-virtual-staging",
    points: [
      ["$12 a month", "Billed again for every photo"],
      ["Minutes", "A day or two of waiting"],
      ["Real listings, with a price", "Usually a 3D library"],
      ["Scale set from the room", "Whatever size the artist picks"],
    ],
  },
  {
    name: "an AI staging app?",
    title: "An AI staging app",
    href: "/blog/furniture-finder-vs-ai-staging-apps",
    points: [
      ["$12 a month", "Credits for every render"],
      ["Pieces you can buy", "A sofa the model invented"],
      ["On the floor, at real size", "Floating, or shrunk to fit"],
      ["Your photo, with its window light", "Walls and windows it may repaint"],
    ],
  },
];

const TYPE = 90;
const ERASE = 30;
const HOLD = 1500;

function useTypedName() {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(ALTERNATIVES[0].name);
      return;
    }
    let word = 0;
    let count = 0;
    let erasing = false;
    let timer = 0;
    const step = () => {
      const full = ALTERNATIVES[word].name;
      count = erasing ? count - 1 : count + 1;
      setIndex(word);
      setText(full.slice(0, count));
      if (!erasing && count === full.length) {
        erasing = true;
        timer = window.setTimeout(step, HOLD);
      } else if (erasing && count === 0) {
        erasing = false;
        word = (word + 1) % ALTERNATIVES.length;
        timer = window.setTimeout(step, TYPE);
      } else {
        timer = window.setTimeout(step, erasing ? ERASE : TYPE);
      }
    };
    timer = window.setTimeout(step, TYPE);
    return () => window.clearTimeout(timer);
  }, []);

  return { index, text };
}

export default function Compare() {
  const { index, text } = useTypedName();

  return (
    <section className="mx-auto w-full max-w-[1120px] px-5 py-20 md:py-28" id="compare">
      <h2 className="m-0 text-center font-display text-[clamp(2rem,5vw,3.2rem)] leading-[0.95] tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:1.5px_#1a1a1a] [paint-order:stroke_fill]">
        How is it better than{" "}
        <span className="mt-3 block normal-case tracking-normal md:inline-block">
          <span className="rounded-lg bg-hot/15 px-2 pr-3 text-hot [-webkit-text-stroke:0] [text-shadow:none]">{text}</span>
          <span className="animate-pulse text-hot [-webkit-text-stroke:0] [text-shadow:none]">|</span>
        </span>
      </h2>
      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
        {ALTERNATIVES.map((alt, i) => (
          <article
            className={`rounded-[22px] border-[3px] bg-white p-5 shadow-[6px_6px_0_0_#1a1a1a] transition-colors ${i === index ? "border-hot" : "border-ink"}`}
            key={alt.name}
          >
            <h3 className="m-0 font-display text-2xl font-normal tracking-[0.02em]">{alt.title}</h3>
            <ul className="mt-4 grid list-none gap-3 p-0">
              {alt.points.map(([ours, theirs]) => (
                <li className="text-sm leading-snug" key={ours}>
                  <span className="font-bold">{ours}</span>
                  <span className="text-ink/55">, not {theirs[0].toLowerCase() + theirs.slice(1)}</span>
                </li>
              ))}
            </ul>
            <a className="mt-5 inline-block text-sm font-bold text-ink underline decoration-hot decoration-2 underline-offset-4 hover:text-hot" href={alt.href}>
              {alt.title} vs Furniture Finder, in full
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

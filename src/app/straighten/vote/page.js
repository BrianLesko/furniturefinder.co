"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import { assessStraightenCandidate } from "@/lib/candidate";
import { straightenQuad, straightenVerticals } from "@/lib/perspective";
import { rankMethods } from "@/lib/ranking";
import { uprightFull, uprightGentle } from "@/lib/upright";
import { BEST, NOT_ROOM, RETAKE, STRAIGHTEN_METHODS } from "@/lib/straighten-methods";

const HOW = {
  "original-v1": { original: true },
  "lines-v1": {},
  "corners-v1": {},
  "plumb-v1": {},
  "plumb-v2": {},
  "snap-mp3d-v2": { variant: "mp3d" },
  "snap-st2d3d-v2": { variant: "st2d3d" },
};
const METHODS = STRAIGHTEN_METHODS.filter((m) => m.status === "active" && HOW[m.id]).map((m) => ({
  ...m,
  ...HOW[m.id],
}));
const SNAPS = METHODS.filter((m) => m.variant);

// Voting is blind: tiles are shuffled per photo and keyed by position, so
// neither a label nor a habitual key gives a method away.
const SLOTS = "ABCDEFGHIJ";
const YAY_KEYS = "1234567890";
const NAY_KEYS = "qwertyuiop";

/** The same shuffle every time a photo is shown, so going back is stable. */
function shuffledFor(id, items) {
  let seed = 2166136261;
  for (const ch of id) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507) ^ Math.imul(seed ^ (seed >>> 13), 3266489909);
    const j = (seed >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const press =
  "inline-flex items-center justify-center rounded-full border-ink font-bold no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#1a1a1a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none cursor-pointer disabled:cursor-default disabled:opacity-40";

const toPoints = (quad) => quad.map(([x, y]) => ({ x, y }));

function render(canvas) {
  return canvas ? canvas.toDataURL("image/jpeg", 0.85) : null;
}

const toLine = ([x1, y1, x2, y2]) => [
  { x: x1, y: y1 },
  { x: x2, y: y2 },
];

async function askLayout(src, variant) {
  const photo = await (await fetch(src)).blob();
  const response = await fetch(`/api/layout?variant=${variant}`, { method: "POST", body: photo });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "The layout model failed on this photo.");
  return body;
}

export default function VotePage() {
  const imgRef = useRef(null);
  const layoutsRef = useRef({});
  const measuredRef = useRef(new Set());
  const [photos, setPhotos] = useState(null);
  const [votes, setVotes] = useState({});
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState({});

  useEffect(() => {
    (async () => {
      const [manifest, saved] = await Promise.all([
        fetch("/vote-set/manifest.json").then((r) => r.json()),
        fetch("/api/votes").then((r) => r.json()),
      ]);
      setPhotos(manifest);
      setVotes(saved);
      // Start in the newest batch; photos skipped in older batches wait until
      // Next unvoted wraps around to them.
      const newest = Math.max(...manifest.map((p) => p.batch ?? 1));
      const fresh = manifest.findIndex((p) => (p.batch ?? 1) === newest && !isDone(saved[p.id]));
      const first = manifest.findIndex((p) => !isDone(saved[p.id]));
      setIndex(fresh >= 0 ? fresh : Math.max(first, 0));
    })();
  }, []);

  const photo = photos?.[index];
  const order = useMemo(() => (photo ? shuffledFor(photo.id, METHODS) : []), [photo]);

  const layoutFor = useCallback((src, variant) => {
    const key = `${variant}|${src}`;
    if (!layoutsRef.current[key]) {
      layoutsRef.current[key] = askLayout(src, variant);
      layoutsRef.current[key].catch(() => delete layoutsRef.current[key]);
    }
    return layoutsRef.current[key];
  }, []);

  const measure = useCallback(
    async (img) => {
      if (!photo || !img.naturalWidth || measuredRef.current.has(photo.id)) return;
      const id = photo.id;
      measuredRef.current.add(id);
      let candidate = { ok: false };
      try {
        candidate = assessStraightenCandidate(img);
      } catch {
        candidate = { ok: false };
      }
      const attempt = (fn) => {
        try {
          return render(fn());
        } catch {
          return null;
        }
      };
      const next = {
        "lines-v1": candidate.lines
          ? { src: attempt(() => straightenVerticals(img, candidate.lines)) }
          : { none: "The detector found no pair of verticals." },
        "corners-v1": candidate.quad
          ? { src: attempt(() => straightenQuad(img, candidate.quad)) }
          : { none: "The detector found no wall facing the camera." },
        "plumb-v1": { loading: true },
        "plumb-v2": { loading: true },
        ...Object.fromEntries(SNAPS.map((m) => [m.id, { loading: true }])),
      };
      setResults((r) => ({ ...r, [id]: next }));
      for (const method of SNAPS) {
        let shown;
        try {
          const { snap, camera, calib } = await layoutFor(photo.src, method.variant);
          if (method.variant === "mp3d") {
            const plumb = snap?.plumb ? { src: attempt(() => uprightFull(img, snap)) } : { none: "No camera tilt." };
            const gentle = calib?.gravity ? { src: attempt(() => uprightGentle(img, calib)) } : { none: "No camera tilt." };
            setResults((r) => ({ ...r, [id]: { ...r[id], camera, "plumb-v1": plumb, "plumb-v2": gentle } }));
          }
          shown = snap?.quad
            ? { src: attempt(() => straightenQuad(img, toPoints(snap.quad))), note: "Back wall square-on" }
            : snap?.lines
              ? { src: attempt(() => straightenVerticals(img, snap.lines.map(toLine))), note: "Corners stood upright" }
              : { none: "The model returned no layout." };
        } catch (error) {
          shown = { none: error.message };
          if (method.variant === "mp3d") setResults((r) => ({ ...r, [id]: { ...r[id], "plumb-v1": shown, "plumb-v2": shown } }));
        }
        setResults((r) => ({ ...r, [id]: { ...r[id], [method.id]: shown } }));
      }
      const ahead = photos[index + 1];
      if (ahead) SNAPS.forEach((m) => layoutFor(ahead.src, m.variant).catch(() => {}));
    },
    [photo, photos, index, layoutFor],
  );

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth && photo && !results[photo.id]) measure(img);
  }, [measure, photo, results]);

  const cast = useCallback(
    async (method, vote) => {
      if (!photo) return;
      const current = votes[photo.id]?.[method];
      const value = current === vote ? null : vote;
      setVotes((v) => {
        const entry = { ...v[photo.id] };
        if (value === null) delete entry[method];
        else entry[method] = value;
        return { ...v, [photo.id]: entry };
      });
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: photo.id, method, vote: value }),
      });
      if (response.ok) setVotes(await response.json());
    },
    [photo, votes],
  );

  const pickBest = useCallback(
    (method) => {
      if (!photo) return;
      const entry = votes[photo.id] ?? {};
      cast(BEST, method);
      if (entry[BEST] !== method && entry[method] !== "yes") cast(method, "yes");
    },
    [photo, votes, cast],
  );

  const go = useCallback(
    (step) => setIndex((i) => Math.min((photos?.length ?? 1) - 1, Math.max(0, i + step))),
    [photos],
  );

  const nextOpen = useCallback(() => {
    if (!photos) return;
    for (let k = 1; k <= photos.length; k++) {
      const i = (index + k) % photos.length;
      if (!isDone(votes[photos[i].id])) return setIndex(i);
    }
  }, [photos, index, votes]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.target.closest?.("input, textarea")) return;
      const key = event.key.toLowerCase();
      const digit = event.shiftKey && /^Digit\d$/.test(event.code) ? event.code.slice(5) : null;
      if (digit) {
        const method = order[YAY_KEYS.indexOf(digit)];
        if (!method) return;
        pickBest(method.id);
      } else if (key === "arrowright") go(1);
      else if (key === "arrowleft") go(-1);
      else if (key === "enter") nextOpen();
      else if (key === "x") cast(NOT_ROOM, "yes");
      else if (key === "z") cast(RETAKE, "yes");
      else if (key === "a") cast(RETAKE, "no");
      else {
        const yes = YAY_KEYS.indexOf(key);
        const no = NAY_KEYS.indexOf(key);
        if (yes >= 0 && order[yes]) cast(order[yes].id, "yes");
        else if (no >= 0 && order[no]) cast(order[no].id, "no");
        else return;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, nextOpen, cast, pickBest, order]);

  const done = photos ? photos.filter((p) => isDone(votes[p.id])).length : 0;
  const mine = photo ? (votes[photo.id] ?? {}) : {};
  const notRoom = mine[NOT_ROOM] === "yes";
  const shown = photo ? results[photo.id] : null;
  // Names appear once every tile on the photo has a vote.
  const reveal = order.length > 0 && order.every((m) => mine[m.id]);

  return (
    <>
      <Header width="max-w-[1280px]">
        <a className={`${press} border-[3px] bg-white px-4 py-2 text-sm`} href="/straighten">
          Straighten
        </a>
      </Header>

      <main className="mx-auto w-full max-w-[1280px] px-5 pt-6 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="m-0 font-display text-[2.4rem] leading-none tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:2px_#1a1a1a] [paint-order:stroke_fill]">
            Vote on the straightening
          </h1>
          {photos ? (
            <p className="m-0 font-mono text-[13px]">
              Photo {index + 1} of {photos.length} · {photo?.group} · {done} done
            </p>
          ) : null}
        </div>
        <p className="mt-2 mb-0 font-mono text-[12px] text-ink/60">
          Tiles are shuffled and unnamed until you have voted on all of them. Keys go by position: 1–7 yay, Q W E R T Y U
          nay, Shift+1–7 best of the set, X not a room, Z retake, A fine as shot, ← → move, Enter next unvoted. Press a
          vote again to clear it.
        </p>

        {photo ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" className={`${press} border-2 bg-white px-4 py-1.5 text-sm`} onClick={() => go(-1)} disabled={index === 0}>
                ← Back
              </button>
              <button type="button" className={`${press} border-2 bg-white px-4 py-1.5 text-sm`} onClick={() => go(1)} disabled={index === photos.length - 1}>
                Next →
              </button>
              <button type="button" className={`${press} border-2 bg-hot px-4 py-1.5 text-sm text-white`} onClick={nextOpen}>
                Next unvoted
              </button>
              <button
                type="button"
                className={`${press} border-2 px-4 py-1.5 text-sm ${notRoom ? "bg-ink text-white" : "bg-white"}`}
                aria-pressed={notRoom}
                onClick={() => cast(NOT_ROOM, "yes")}
              >
                Not a room
              </button>
              <span className="ml-2 font-mono text-[13px] text-ink/70">Retake?</span>
              {[
                ["yes", "Retake", "Z", "bg-hot text-white"],
                ["no", "Fine as shot", "A", "bg-[#2f9e5b] text-white"],
              ].map(([value, label, key, on]) => (
                <button
                  key={value}
                  type="button"
                  className={`${press} border-2 px-4 py-1.5 text-sm ${mine[RETAKE] === value ? on : "bg-white"}`}
                  aria-pressed={mine[RETAKE] === value}
                  onClick={() => cast(RETAKE, value)}
                >
                  {label} <span className="ml-1 opacity-60">{key}</span>
                </button>
              ))}
            </div>
            <CameraCheck camera={shown?.camera} />

            <img
              key={photo.src}
              ref={imgRef}
              className="hidden"
              src={photo.src}
              alt=""
              onLoad={(event) => measure(event.currentTarget)}
            />
            <div className={`mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 ${notRoom ? "opacity-50" : ""}`}>
              {order.map((method, slot) => {
                const raw = method.original ? { src: photo.src } : shown?.[method.id];
                // A method that finds nothing leaves the photo as taken, so
                // show exactly that rather than a message that names it.
                const result = raw?.none || (raw && !raw.loading && !raw.src) ? { src: photo.src } : raw;
                const vote = mine[method.id];
                const keys = [YAY_KEYS[slot], NAY_KEYS[slot]];
                return (
                  <figure
                    key={method.id}
                    data-method={method.id}
                    className={`m-0 overflow-hidden rounded-[22px] border-[3px] bg-white shadow-[6px_6px_0_0_#1a1a1a] ${
                      vote === "yes" ? "border-[#2f9e5b]" : vote === "no" ? "border-hot" : "border-ink"
                    }`}
                  >
                    <div className="bg-cream">
                      {result?.src ? (
                        <img className="block h-auto w-full" src={result.src} alt={`Result ${SLOTS[slot]}`} />
                      ) : (
                        <div className="grid aspect-[4/3] place-items-center px-6 text-center font-mono text-[13px] text-ink/70">
                          Working…
                        </div>
                      )}
                    </div>
                    <figcaption className="flex items-center justify-between gap-3 px-4 py-2.5 font-mono text-[13px]">
                      <span>
                        <span className="font-bold">{SLOTS[slot]}</span>
                        {reveal ? <span className="text-ink/55"> · {method.label}</span> : null}
                      </span>
                      <span className="flex gap-2">
                        {[
                          ["yes", "Yay", keys[0], "bg-[#2f9e5b] text-white"],
                          ["no", "Nay", keys[1].toUpperCase(), "bg-hot text-white"],
                        ].map(([value, label, key, on]) => (
                          <button
                            key={value}
                            type="button"
                            className={`${press} border-2 px-3 py-0.5 text-xs ${vote === value ? on : "bg-white"}`}
                            aria-pressed={vote === value}
                            onClick={() => cast(method.id, value)}
                          >
                            {label} <span className="ml-1 opacity-60">{key}</span>
                          </button>
                        ))}
                        <button
                          type="button"
                          className={`${press} border-2 px-2.5 py-0.5 text-xs ${mine[BEST] === method.id ? "bg-ink text-white" : "bg-white"}`}
                          aria-pressed={mine[BEST] === method.id}
                          aria-label={`Best result: ${SLOTS[slot]}`}
                          title={`Best of the set (Shift+${keys[0]})`}
                          onClick={() => pickBest(method.id)}
                        >
                          ★
                        </button>
                      </span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
            <Standings votes={votes} />
          </>
        ) : (
          <p className="mt-8 font-mono text-sm">Loading the photo set…</p>
        )}
      </main>
    </>
  );
}

const percent = (value) => `${Math.round(value * 100)}%`;

function CameraCheck({ camera }) {
  if (!camera) {
    return <p className="mt-3 mb-0 font-mono text-[13px] text-ink/60">Checking where the camera was…</p>;
  }
  const tilt = Math.abs(camera.pitch) < 1 ? "level" : `tilted ${Math.abs(camera.pitch).toFixed(0)}° ${camera.pitch < 0 ? "down" : "up"}`;
  const height = camera.height == null ? "height unknown" : `about ${(camera.height * 8).toFixed(1)} ft up on an 8 ft ceiling`;
  return (
    <div
      className={`mt-3 rounded-2xl border-2 border-ink px-4 py-2 font-mono text-[13px] ${camera.retake ? "bg-blush" : "bg-white"}`}
      data-retake={camera.retake}
    >
      <span className="font-bold">{camera.retake ? "Suggest a retake" : "Camera looks fine"}</span>
      <span className="text-ink/70">
        {" "}
        · {tilt} · {height}
      </span>
      {camera.advice.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </div>
  );
}

function Standings({ votes }) {
  const ranking = useMemo(() => rankMethods(votes), [votes]);
  return (
    <section className="mt-8 overflow-x-auto rounded-[22px] border-[3px] border-ink bg-white p-5 shadow-[6px_6px_0_0_#1a1a1a]">
      <h2 className="m-0 font-display text-[1.6rem] leading-none tracking-[0.02em]">Standings</h2>
      <p className="mt-2 mb-0 font-mono text-[12px] leading-relaxed text-ink/70">
        {ranking.photos} rooms judged, {ranking.picked} with a best pick. Ranked by{" "}
        {ranking.basis === "picks" ? "chance of being picked best most often" : "chance of the highest yay rate (best picks take over at 10)"}.
        Picking the right method per photo would satisfy {percent(ranking.bestPossible)}.
      </p>
      <table className="mt-4 w-full border-collapse font-mono text-[13px]">
        <thead>
          <tr className="text-left text-ink/60">
            <th className="py-1 pr-4 font-normal">Method</th>
            <th className="py-1 pr-4 font-normal">Yays</th>
            <th className="py-1 pr-4 font-normal">Yay rate (90% range)</th>
            <th className="py-1 pr-4 font-normal">Best picks</th>
            <th className="py-1 pr-4 font-normal">Chance it is best</th>
            <th className="py-1 pr-4 font-normal">Against the leader</th>
            <th className="py-1 font-normal">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {ranking.rows.map((row) => (
            <tr key={row.id} className="border-t-2 border-ink/10">
              <td className="py-1.5 pr-4 font-bold">{row.label}</td>
              <td className="py-1.5 pr-4">
                {row.yes} of {row.votes}
              </td>
              <td className="py-1.5 pr-4">
                {percent(row.rate)} ({percent(row.low)}–{percent(row.high)})
              </td>
              <td className="py-1.5 pr-4">{row.picks}</td>
              <td className="py-1.5 pr-4">{percent(row.chance)}</td>
              <td className="py-1.5 pr-4">
                {row.vsLeader ? `${row.vsLeader.wins} won, ${row.vsLeader.losses} lost, ${row.vsLeader.ties} tied` : "—"}
              </td>
              <td className={`py-1.5 ${row.verdict === "retire" ? "text-hot" : row.verdict === "use in production" ? "font-bold text-[#2f9e5b]" : ""}`}>
                {row.verdict}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// Any vote marks a photo as seen, so adding a method later doesn't send the
// voter back through photos they have already judged.
function isDone(entry) {
  return Boolean(entry && Object.keys(entry).length);
}

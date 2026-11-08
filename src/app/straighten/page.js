"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { assessStraightenCandidate } from "@/lib/candidate";
import { padWithFill, straightenQuad, straightenVerticals } from "@/lib/perspective";
import { PRESETS } from "@/lib/presets";
import { uprightPlan } from "@/lib/upright";

const DEFAULT_SRC = PRESETS[0].src;
const PREVIEW_PAD = 0.06;
const LOUPE = 132;
const LOUPE_BORDER = 3;
const LOUPE_GAP = 22;
const LOUPE_ZOOM = 3;
const EXPANDED_CHROME = "8rem";

const MODES = [
  { id: "upright", label: "Upright" },
  { id: "verticals", label: "Two lines" },
  { id: "wall", label: "Four corners" },
  { id: "model-mp3d", label: "Model · Matterport" },
  { id: "model-pano", label: "Model · PanoContext" },
  { id: "model-st2d3d", label: "Model · Stanford" },
  { id: "snap", label: "Model · Snapped" },
];

const isModel = (mode) => Boolean(mode?.startsWith("model-"));
// Snapped is the Matterport model's layout cut into straight edges, with its
// back wall as four draggable corners.
// Upright is the default: GeoCalib's camera tilt taken out, by the rule in
// lib/upright.js.
const usesModel = (mode) => isModel(mode) || mode === "snap" || mode === "upright";
const variantFor = (mode) => (mode === "snap" || mode === "upright" ? "mp3d" : mode.slice("model-".length));
const modelLabel = (mode) => MODES.find((m) => m.id === mode)?.label ?? "Model";

// Where the handles start, as fractions of the photo, when the check found no
// fit for that mode.
const STARTING = {
  wall: [[0.25, 0.2], [0.75, 0.2], [0.75, 0.8], [0.25, 0.8]],
  verticals: [[0.25, 0.15], [0.25, 0.85], [0.75, 0.15], [0.75, 0.85]],
};
STARTING.snap = STARTING.wall;

const copyPoints = (points) => points.map((p) => ({ x: p.x, y: p.y }));

const LABELS = {
  wall: ["Top left corner", "Top right corner", "Bottom right corner", "Bottom left corner"],
  verticals: ["First line top", "First line bottom", "Second line top", "Second line bottom"],
};
LABELS.snap = LABELS.wall;

const press =
  "inline-flex items-center justify-center rounded-full border-ink font-bold no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#1a1a1a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none cursor-pointer";

export default function StraightenPage() {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const padRef = useRef(null);
  const dragRef = useRef(null);
  const urlRef = useRef(null);
  const fittedRef = useRef({});
  const editsRef = useRef({});
  const [src, setSrc] = useState(DEFAULT_SRC);
  const [natural, setNatural] = useState(null);
  const [quad, setQuad] = useState(null);
  const [mode, setMode] = useState(null);
  const [status, setStatus] = useState("checking");
  const [outSize, setOutSize] = useState(null);
  const [loupe, setLoupe] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [layout, setLayout] = useState(null);
  const layoutsRef = useRef({});
  const preferModelRef = useRef("upright");
  const [badge, setBadge] = useState(null);
  const layoutKey = usesModel(mode) ? `${variantFor(mode)}|${src}` : null;

  const measure = useCallback((img) => {
    if (!img.naturalWidth) return;
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    let candidate = { ok: false };
    try {
      candidate = assessStraightenCandidate(img);
    } catch {
      candidate = { ok: false };
    }
    const fits = {
      wall: candidate.ok ? candidate.quad : null,
      verticals: candidate.ok && candidate.lines ? candidate.lines.flat() : null,
    };
    fittedRef.current = fits;
    editsRef.current = {};
    if (preferModelRef.current) {
      setMode(preferModelRef.current);
      setQuad(null);
      setStatus("model");
      return;
    }
    const fitted = candidate.ok ? fits[candidate.mode] : null;
    if (!fitted) {
      setMode(null);
      setQuad(null);
      setStatus("skip");
      return;
    }
    setMode(candidate.mode);
    setStatus("working");
    setQuad(copyPoints(fitted));
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth) measure(img);
  }, [measure, src]);

  useEffect(() => {
    if (!usesModel(mode)) return;
    const variant = variantFor(mode);
    const key = `${variant}|${src}`;
    const cached = layoutsRef.current[key];
    if (cached) {
      setLayout(cached);
      return;
    }
    let cancelled = false;
    setLayout({ status: "loading", key });
    (async () => {
      let next;
      try {
        const photo = await (await fetch(src)).blob();
        const response = await fetch(`/api/layout?variant=${variant}`, { method: "POST", body: photo });
        const body = await response.json();
        next = response.ok
          ? { status: "ready", key, ...body }
          : { status: "error", key, error: body.error || "The layout model failed on this photo." };
      } catch {
        next = { status: "error", key, error: "Could not reach the layout model." };
      }
      if (next.status === "ready") layoutsRef.current[key] = next;
      if (!cancelled) setLayout(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, src]);

  useEffect(() => {
    if (mode !== "snap" || quad || layout?.status !== "ready" || layout.key !== layoutKey) return;
    const back = layout.snap?.quad;
    fittedRef.current.snap = back ? back.map(([x, y]) => ({ x, y })) : null;
    if (!back) return;
    setStatus("working");
    setQuad(copyPoints(fittedRef.current.snap));
  }, [mode, quad, layout, layoutKey]);

  useEffect(() => {
    setBadge(null);
    const img = imgRef.current;
    if (mode !== "upright" || layout?.status !== "ready" || layout.key !== layoutKey || !img?.naturalWidth) return;
    const plan = uprightPlan(layout);
    let canvas = null;
    try {
      canvas = plan.render(img);
    } catch {
      canvas = null;
    }
    const view = canvasRef.current;
    if (!canvas || !view) {
      setStatus("bad");
      return;
    }
    view.width = canvas.width;
    view.height = canvas.height;
    view.getContext("2d").drawImage(canvas, 0, 0);
    setOutSize({ w: canvas.width, h: canvas.height });
    setBadge(plan.badge);
    setStatus("ready");
  }, [mode, layout, layoutKey, natural]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !quad || !img.naturalWidth) return;
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      let canvas = null;
      try {
        canvas =
          mode === "verticals"
            ? straightenVerticals(img, [
                [quad[0], quad[1]],
                [quad[2], quad[3]],
              ])
            : straightenQuad(img, quad);
      } catch {
        canvas = null;
      }
      if (cancelled) return;
      const view = canvasRef.current;
      if (!canvas || !view) {
        setStatus("bad");
        return;
      }
      view.width = canvas.width;
      view.height = canvas.height;
      view.getContext("2d").drawImage(canvas, 0, 0);
      setOutSize((current) =>
        current && current.w === canvas.width && current.h === canvas.height
          ? current
          : { w: canvas.width, h: canvas.height },
      );
      setStatus((current) => (current === "ready" ? current : "ready"));
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [mode, quad]);

  useEffect(() => {
    const img = imgRef.current;
    const view = padRef.current;
    if (!img || !view || !natural) return;
    let padded = null;
    try {
      padded = padWithFill(img, PREVIEW_PAD);
    } catch {
      padded = null;
    }
    if (!padded) return;
    view.width = padded.width;
    view.height = padded.height;
    view.getContext("2d").drawImage(padded, 0, 0);
  }, [natural, src]);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event) => {
      if (event.key === "Escape") setExpanded(null);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  function pointFromEvent(event) {
    const img = imgRef.current;
    const rect = img.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * img.naturalWidth;
    const y = ((event.clientY - rect.top) / rect.height) * img.naturalHeight;
    return {
      x: Math.min(img.naturalWidth, Math.max(0, x)),
      y: Math.min(img.naturalHeight, Math.max(0, y)),
    };
  }

  function onPointerDown(event, index) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = index;
    const rect = imgRef.current.getBoundingClientRect();
    setLoupe({ index, w: rect.width, h: rect.height });
  }

  function onPointerMove(event) {
    if (dragRef.current == null) return;
    const index = dragRef.current;
    const next = pointFromEvent(event);
    setQuad((current) => current.map((p, i) => (i === index ? next : p)));
  }

  function onPointerUp() {
    dragRef.current = null;
    setLoupe(null);
  }

  function onKeyDown(event, index) {
    const step = event.shiftKey ? 10 : 1;
    const move = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[event.key];
    if (!move || !natural) return;
    event.preventDefault();
    setQuad((current) =>
      current.map((p, i) => {
        if (i !== index) return p;
        return {
          x: Math.min(natural.w, Math.max(0, p.x + move[0])),
          y: Math.min(natural.h, Math.max(0, p.y + move[1])),
        };
      }),
    );
  }

  function load(next) {
    if (next === src) return;
    setStatus("checking");
    setMode(null);
    setQuad(null);
    setNatural(null);
    setOutSize(null);
    setLoupe(null);
    setSrc(next);
  }

  function onFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const previous = urlRef.current;
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    load(url);
    if (previous) URL.revokeObjectURL(previous);
  }

  function onPreset(preset) {
    load(preset.src);
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }

  function fitFor(next) {
    const fitted = fittedRef.current[next];
    if (fitted) return copyPoints(fitted);
    return STARTING[next].map(([fx, fy]) => ({ x: fx * natural.w, y: fy * natural.h }));
  }

  function switchMode(next) {
    if (next === mode || !natural) return;
    if (mode && quad) editsRef.current[mode] = quad;
    preferModelRef.current = usesModel(next) ? next : null;
    setMode(next);
    const edited = editsRef.current[next];
    if (isModel(next) || next === "upright" || (next === "snap" && !edited && !fittedRef.current.snap)) {
      setQuad(null);
      setStatus("model");
      return;
    }
    setStatus("working");
    setQuad(edited ? copyPoints(edited) : fitFor(next));
  }

  function resetCorners() {
    if (!mode || isModel(mode) || mode === "upright" || !natural) return;
    delete editsRef.current[mode];
    setQuad(fitFor(mode));
  }

  const points = quad && natural ? quad.map((p) => `${p.x},${p.y}`).join(" ") : "";
  const padPercent = natural ? ((PREVIEW_PAD * natural.h) / natural.w) * 100 : 0;
  const originalOpen = expanded === "original";
  const resultOpen = expanded === "result";
  const fitWidth = (ratio) => ({ width: `min(100%, calc((100dvh - ${EXPANDED_CHROME}) * ${ratio}))` });
  const cardClass = (open) =>
    `overflow-hidden rounded-[28px] border-[3px] border-ink bg-white shadow-[8px_8px_0_0_#1a1a1a] ${
      open ? "fixed inset-3 z-50 flex flex-col md:inset-8" : ""
    }`;
  const stageClass = (open) => (open ? "flex min-h-0 flex-1 items-center justify-center bg-cream p-4" : "");
  const expandButton = (name) => (
    <button
      type="button"
      className={`${press} border-2 bg-white px-3 py-0.5 text-xs`}
      aria-expanded={expanded === name}
      onClick={() => setExpanded(expanded === name ? null : name)}
    >
      {expanded === name ? "Close" : "Expand"}
    </button>
  );

  let loupeStyle = null;
  const loupePoint = loupe && quad && natural ? quad[loupe.index] : null;
  if (loupePoint) {
    const fx = loupePoint.x / natural.w;
    const fy = loupePoint.y / natural.h;
    const zw = loupe.w * LOUPE_ZOOM;
    const zh = loupe.h * LOUPE_ZOOM;
    const inner = LOUPE - LOUPE_BORDER * 2;
    const reach = LOUPE_GAP + LOUPE;
    const flipX = fx * loupe.w + reach > loupe.w;
    const flipY = fy * loupe.h - reach < 0;
    loupeStyle = {
      width: LOUPE,
      height: LOUPE,
      left: flipX ? `calc(${fx * 100}% - ${reach}px)` : `calc(${fx * 100}% + ${LOUPE_GAP}px)`,
      top: flipY ? `calc(${fy * 100}% + ${LOUPE_GAP}px)` : `calc(${fy * 100}% - ${reach}px)`,
      backgroundImage: `url("${src}")`,
      backgroundSize: `${zw}px ${zh}px`,
      backgroundPosition: `${inner / 2 - fx * zw}px ${inner / 2 - fy * zh}px`,
      backgroundRepeat: "no-repeat",
    };
  }

  return (
    <>
      <Header>
        <a className={`${press} border-[3px] bg-white px-4 py-2 text-sm`} href="/#rooms">
          Rooms
        </a>
      </Header>

      <main className="mx-auto w-full max-w-[1120px] px-5 pt-12 pb-24 max-md:pt-8">
        <h1 className="m-0 text-center font-display text-[clamp(2.6rem,7vw,4.4rem)] leading-[0.92] tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:3px_#1a1a1a] [paint-order:stroke_fill] [text-shadow:4px_4px_0_#fff]">
          Straighten the photo
        </h1>
        <p className="mx-auto mt-6 mb-0 max-w-[38rem] text-center text-[1.0625rem] leading-[1.7]">
          When a wall faces the camera, drag its four corners and the whole photo is squared to
          that wall. When the photo is shot into a corner, drag two lines onto verticals and they
          are made to stand upright. Both run on this device.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <label className={`${press} border-[3px] bg-hot px-5 py-2.5 font-display text-xl text-white`}>
            Choose a photo
            <input className="sr-only" type="file" accept="image/*" onChange={onFile} />
          </label>
          {mode && !isModel(mode) && mode !== "upright" ? (
            <button type="button" className={`${press} border-[3px] bg-white px-5 py-2.5 font-display text-xl`} onClick={resetCorners}>
              {mode === "verticals" ? "Reset lines" : "Reset corners"}
            </button>
          ) : null}
        </div>
        {natural ? (
          <div className="mt-4 flex justify-center" role="group" aria-label="Straighten mode">
            <div className="inline-flex overflow-hidden rounded-full border-[3px] border-ink bg-white shadow-[3px_3px_0_0_#1a1a1a]">
              {MODES.map((option, i) => {
                const active = mode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`cursor-pointer px-4 py-1.5 font-mono text-[13px] font-bold transition ${i ? "border-l-[3px] border-ink" : ""} ${
                      active ? "bg-hot text-white" : "hover:bg-cream"
                    }`}
                    aria-pressed={active}
                    onClick={() => switchMode(option.id)}
                  >
                    {option.label}
                    {usesModel(option.id) || fittedRef.current[option.id] ? "" : " (manual)"}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="mt-6">
          <p className="m-0 text-center font-mono text-[13px] text-ink/70">Or try a room from 326 Wyandotte Ave</p>
          <ul className="m-0 mt-3 flex list-none flex-wrap justify-center gap-3 p-0">
            {PRESETS.map((preset) => {
              const active = src === preset.src;
              return (
                <li key={preset.slug}>
                  <button
                    type="button"
                    className={`group block w-[104px] cursor-pointer overflow-hidden rounded-2xl border-[3px] border-ink bg-white p-0 text-left transition max-md:w-[92px] ${
                      active
                        ? "translate-x-[3px] translate-y-[3px] shadow-none outline-[3px] outline-offset-2 outline-hot"
                        : "shadow-[3px_3px_0_0_#1a1a1a] hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_0_#1a1a1a]"
                    }`}
                    aria-pressed={active}
                    onClick={() => onPreset(preset)}
                  >
                    <img className="block aspect-[4/3] w-full object-cover" src={preset.thumb} alt="" loading="lazy" />
                    <span className={`block border-t-[3px] border-ink px-2 py-1 font-mono text-[11px] font-bold ${active ? "bg-hot text-white" : ""}`}>
                      {preset.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {expanded ? (
          <div className="fixed inset-0 z-40 bg-ink/70" aria-hidden="true" onClick={() => setExpanded(null)} />
        ) : null}
        <div className="mt-8 grid grid-cols-1 items-start gap-[18px] md:-mx-4 md:grid-cols-2">
          <figure className={cardClass(originalOpen)}>
            <div className={stageClass(originalOpen)}>
              <div
                className="w-full"
                style={originalOpen && natural ? fitWidth(natural.w / (natural.h * (1 + 2 * PREVIEW_PAD))) : undefined}
              >
                <div
                  className="relative bg-cream"
                  style={{ paddingTop: `${padPercent}%`, paddingBottom: `${padPercent}%` }}
                >
                  <canvas ref={padRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
                  <div className="relative">
                    <img
                      ref={imgRef}
                      className="block h-auto w-full select-none"
                      src={src}
                      alt={
                        mode === "verticals"
                          ? "Listing photo with two draggable vertical lines"
                          : mode === "wall" || (mode === "snap" && quad)
                            ? "Listing photo with draggable corners of a wall"
                            : "Listing photo"
                      }
                      draggable={false}
                      onLoad={(event) => measure(event.currentTarget)}
                    />
                    {usesModel(mode) && layout?.status === "ready" && layout.key === layoutKey ? (
                      <svg
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        viewBox={`0 0 ${layout.width} ${layout.height}`}
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        {mode === "snap" && layout.snap
                          ? [
                              ["ceiling", "#4a9bd9"],
                              ["floor", "#ff6b4a"],
                              ["uprights", "#2f9e5b"],
                            ].flatMap(([key, color]) =>
                              layout.snap[key].map(([x1, y1, x2, y2], i) => (
                                <line
                                  key={`${key}${i}`}
                                  x1={x1}
                                  y1={y1}
                                  x2={x2}
                                  y2={y2}
                                  stroke={color}
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  vectorEffect="non-scaling-stroke"
                                />
                              )),
                            )
                          : null}
                        {isModel(mode) && [
                          ["ceiling", "#4a9bd9"],
                          ["floor", "#ff6b4a"],
                        ].map(([key, color]) =>
                          layout[key].length > 1 ? (
                            <polyline
                              key={key}
                              points={layout[key].map(([x, y]) => `${x},${y}`).join(" ")}
                              fill="none"
                              stroke={color}
                              strokeWidth="2.5"
                              strokeLinejoin="round"
                              vectorEffect="non-scaling-stroke"
                            />
                          ) : null,
                        )}
                      </svg>
                    ) : null}
                    {mode && quad && natural ? (
                      <>
                        <svg
                          className="pointer-events-none absolute inset-0 h-full w-full"
                          viewBox={`0 0 ${natural.w} ${natural.h}`}
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          {mode === "verticals" ? (
                            [0, 2].map((i) => (
                              <line
                                key={i}
                                x1={quad[i].x}
                                y1={quad[i].y}
                                x2={quad[i + 1].x}
                                y2={quad[i + 1].y}
                                stroke="#1a1a1a"
                                strokeWidth="1.5"
                                vectorEffect="non-scaling-stroke"
                              />
                            ))
                          ) : (
                            <polygon
                              points={points}
                              fill="rgba(255,107,74,0.16)"
                              stroke="#1a1a1a"
                              strokeWidth="1.5"
                              vectorEffect="non-scaling-stroke"
                            />
                          )}
                        </svg>
                        {quad.map((p, index) => (
                          <button
                            key={LABELS[mode][index]}
                            type="button"
                            className="absolute z-10 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none place-items-center rounded-full border-[3px] border-ink bg-white shadow-[3px_3px_0_0_#1a1a1a] active:cursor-grabbing"
                            style={{ left: `${(p.x / natural.w) * 100}%`, top: `${(p.y / natural.h) * 100}%` }}
                            aria-label={LABELS[mode][index]}
                            onPointerDown={(event) => onPointerDown(event, index)}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onPointerCancel={onPointerUp}
                            onKeyDown={(event) => onKeyDown(event, index)}
                          >
                            <span className="h-3.5 w-3.5 rounded-full bg-hot" />
                          </button>
                        ))}
                        {loupeStyle ? (
                          <div
                            className="pointer-events-none absolute z-20 overflow-hidden rounded-full border-ink bg-cream shadow-[4px_4px_0_0_#1a1a1a]"
                            style={{ ...loupeStyle, borderWidth: LOUPE_BORDER, borderStyle: "solid" }}
                            aria-hidden="true"
                          >
                            <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-hot" />
                            <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-hot" />
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <figcaption className="flex items-center justify-between gap-3 px-4 py-2.5 font-mono text-[13px]">
              <span className="font-bold">Original</span>
              <span className="flex items-center gap-3">
                <span className="text-ink/55">{mode === "verticals"
                    ? "Drag the lines"
                    : mode === "wall" || (mode === "snap" && quad)
                      ? "Drag the corners"
                      : mode === "upright"
                        ? "As taken"
                        : usesModel(mode)
                        ? "Ceiling and floor lines"
                        : "Checked"}</span>
                {natural ? expandButton("original") : null}
              </span>
            </figcaption>
          </figure>

          <figure className={cardClass(resultOpen)}>
            <div className={stageClass(resultOpen)}>
              <div
                className={`w-full ${status === "skip" ? "bg-blush" : "bg-cream"}`}
                style={resultOpen && outSize ? fitWidth(outSize.w / outSize.h) : undefined}
                data-result
                data-status={status}
              >
                <canvas
                  ref={canvasRef}
                  className={`block h-auto w-full ${status === "ready" ? "" : "hidden"}`}
                  role="img"
                  aria-label="Straightened listing photo"
                />
                {status === "ready" && badge ? (
                  <p
                    className="m-0 border-t-[3px] border-ink bg-blush px-4 py-2.5 font-mono text-[13px] font-bold leading-snug"
                    role="status"
                    data-badge="steep"
                  >
                    {badge}
                  </p>
                ) : null}
                {status === "skip" ? (
                  <div className="px-6 py-8">
                    <p className="m-0 font-display text-[2rem] leading-none tracking-[0.02em] text-hot">Leave this photo</p>
                    <p className="mt-4 mb-0 font-mono text-sm leading-relaxed">
                      No wall faces the camera, and there are no long verticals to stand upright, so this photo stays as it was taken. Pick a mode above to place the handles yourself.
                    </p>
                  </div>
                ) : null}
                {status === "model" ? (
                  <div className="px-6 py-8">
                    <p className="m-0 font-display text-[2rem] leading-none tracking-[0.02em] text-hot">Room layout model</p>
                    {mode === "snap" && layout?.status === "ready" && layout.key === layoutKey ? (
                      <p className="mt-4 mb-0 font-mono text-sm leading-relaxed">
                        No wall faces the camera in this photo. If it is shot into a corner, try Two lines, or press Reset corners to place the four corners yourself.
                      </p>
                    ) : layout?.status === "ready" && layout.key === layoutKey ? (
                      <>
                        <ul className="mt-4 mb-0 list-none space-y-2 p-0 font-mono text-sm">
                          <li className="flex items-center gap-2">
                            <span className="inline-block h-1 w-6 rounded-full bg-sky" />
                            Where the ceiling meets the walls
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="inline-block h-1 w-6 rounded-full bg-hot" />
                            Where the floor meets the walls
                          </li>
                        </ul>
                        <p className="mt-4 mb-0 font-mono text-[13px] leading-relaxed text-ink/70">
                          Camera tilted {Math.abs(layout.calib.pitch).toFixed(1)}° {layout.calib.pitch < 0 ? "down" : "up"}, seeing{" "}
                          {Math.round(layout.calib.vfov)}° top to bottom. Took {(layout.ms / 1000).toFixed(1)} s on the GPU.
                        </p>
                      </>
                    ) : (
                      <p className="mt-4 mb-0 font-mono text-sm leading-relaxed">
                        {layout?.status === "error" && layout.key === layoutKey ? layout.error : "Asking the model…"}
                      </p>
                    )}
                  </div>
                ) : null}
                {status !== "ready" && status !== "skip" && status !== "model" ? (
                  <div className="grid aspect-[4/3] place-items-center px-6 text-center font-mono text-[13px] text-ink/70">
                    {status === "bad"
                      ? mode === "verticals"
                        ? "Those lines meet inside the photo. Move each onto a vertical edge."
                        : "Those corners cross. Spread them into a four-sided wall."
                      : status === "checking"
                        ? "Checking the walls…"
                        : "Straightening…"}
                  </div>
                ) : null}
              </div>
            </div>
            <figcaption className="flex items-center justify-between gap-3 px-4 py-2.5 font-mono text-[13px]">
              <span className="font-bold">{status === "skip" ? "Not a candidate" : status === "model" ? modelLabel(mode) : "Straightened"}</span>
              <span className="flex items-center gap-3">
                <span className="text-ink/55">
                  {status === "skip"
                    ? "Nothing to stand upright"
                    : status === "model"
                      ? "uLayout and GeoCalib"
                      : mode === "upright"
                        ? badge
                          ? "Camera turned most of the way level"
                          : "Camera turned level"
                      : mode === "verticals"
                        ? "Upright verticals"
                        : "Wall square-on"}
                </span>
                {status === "ready" || resultOpen ? expandButton("result") : null}
              </span>
            </figcaption>
          </figure>
        </div>
      </main>
      <Footer />
    </>
  );
}

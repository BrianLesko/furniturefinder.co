"use client";

import { useCallback, useEffect, useState } from "react";

const card = "rounded-[22px] border-[3px] border-ink bg-white p-5 shadow-[6px_6px_0_0_#1a1a1a]";
const press =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink px-4 py-2 text-sm font-bold shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_0_#1a1a1a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:translate-0";
const field = "w-full rounded-xl border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:bg-yellow/40";
const label = "mb-1 block text-xs font-bold tracking-[0.08em] text-ink/60 uppercase";

const AROUND = [
  "front",
  "one-quarter",
  "three-quarter",
  "other-front-side",
  "front-side",
  "other-side",
  "side",
  "other-back-side",
  "back-side",
  "back-one-quarter",
  "back-three-quarter",
  "back",
];
const SHOT_ANGLES = [...AROUND, "top"];
// Written as flips unless the piece's sides differ.
const FAR_SIDE = ["one-quarter", "other-front-side", "other-side", "other-back-side", "back-one-quarter"];
const GENERATED = AROUND;

const SYMMETRY_HELP = {
  mirror: "Left and right match (most sofas, chairs, beds, consoles)",
  none: "Left and right differ (sectionals with a chaise, desks with a return)",
  rectangle: "Also the same from behind (rectangular tables, rugs, ottomans)",
  square: "The same every quarter turn (square or round tables on four legs, stools)",
  round: "The same from every side (pedestal round tables, round poufs)",
};

const ALTITUDES = [
  [5, "Level (5°)"],
  [10, "Slightly above (10°)"],
  [15, "Above (15°)"],
  [25, "Well above (25°)"],
];

const dollars = (cents) => (cents == null ? "" : String(cents / 100));
const cents = (value) => (value === "" ? null : Math.round(Number(value) * 100));

export default function AddPiece({ token, categories, rooms, viewLabels }) {
  const [drafts, setDrafts] = useState([]);
  const [draft, setDraft] = useState(null);
  const [details, setDetails] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState([]);
  const [link, setLink] = useState("");

  const api = useCallback(
    async (path, { method = "GET", json, form } = {}) => {
      const response = await fetch(`/api/pieces${path}`, {
        method,
        headers: { "x-team-token": token, ...(json ? { "Content-Type": "application/json" } : {}) },
        body: json ? JSON.stringify(json) : form,
      });
      const body = await response.json().catch(() => ({ error: `The server answered ${response.status}.` }));
      if (!response.ok) throw new Error(body.error ?? `The server answered ${response.status}.`);
      return body;
    },
    [token],
  );

  const refresh = useCallback(async () => setDrafts((await api("/drafts")).drafts), [api]);

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [refresh]);

  function show(next) {
    setDraft(next);
    setDetails(next ? next.details : null);
  }

  async function run(what, fn) {
    setBusy(what);
    setError(null);
    try {
      const result = await fn();
      if (result?.id && result?.details) show(result);
      await refresh();
      return result;
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function startFromLink(event) {
    event.preventDefault();
    await run("import", async () => {
      let imported = { details: { sourceUrl: link }, candidates: [], notes: [] };
      try {
        imported = await api("/import", { method: "POST", json: { url: link } });
      } catch (err) {
        imported.notes = [`Could not read that page (${err.message}). Fill in the details by hand and add photos by link or upload.`];
      }
      setNotes([...(imported.notes ?? []), ...(imported.dimensionSnippets?.length ? [`Sizes found on the page: ${imported.dimensionSnippets.join(" · ")}`] : [])]);
      setLink("");
      return api("/drafts", { method: "POST", json: imported });
    });
  }

  async function saveDetails(patch) {
    const next = { ...details, ...patch };
    setDetails(next);
    return run("save", () => api(`/drafts/${draft.id}`, { method: "PATCH", json: { details: next } }));
  }

  const photos = draft?.photos ?? [];
  const byAngle = Object.fromEntries(photos.filter((p) => p.angle).map((p) => [p.angle, p]));
  const used = new Set(photos.map((p) => p.fromUrl).filter(Boolean));
  const published = Boolean(draft?.productId);
  const isRug = details?.category === "rug";

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className={`${card} h-fit`}>
        <form onSubmit={startFromLink}>
          <span className={label}>Product link</span>
          <input className={field} type="url" required placeholder="https://www.ikea.com/us/en/p/…" value={link} onChange={(e) => setLink(e.target.value)} />
          <button type="submit" className={`${press} mt-3 w-full bg-hot text-white`} disabled={busy === "import"}>
            {busy === "import" ? "Reading the page…" : "Start a piece"}
          </button>
        </form>
        <h2 className="mt-6 mb-2 font-display text-xl tracking-[0.02em]">Pieces</h2>
        {drafts.length === 0 ? <p className="m-0 text-sm text-ink/60">None yet.</p> : null}
        <ul className="m-0 grid list-none gap-1.5 p-0">
          {drafts.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => run("open", () => api(`/drafts/${d.id}`)).then(() => setNotes([]))}
                className={`w-full rounded-xl border-2 px-3 py-2 text-left text-sm ${draft?.id === d.id ? "border-hot bg-blush" : "border-ink/15 hover:border-ink"}`}
              >
                <span className="block font-bold">{d.name}</span>
                <span className="block text-xs text-ink/60">
                  {d.productId ? "Published" : "Draft"}
                  {d.addedBy ? ` · ${d.addedBy}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="grid min-w-0 gap-6">
        {error ? (
          <div role="alert" className="rounded-2xl border-[3px] border-ink bg-blush px-4 py-3 text-sm font-bold">
            {error}
          </div>
        ) : null}
        {!draft ? (
          <div className={card}>
            <p className="m-0 font-note text-[1.8rem] leading-tight">Paste a product link to start, or open a piece on the left.</p>
          </div>
        ) : (
          <>
            {notes.length ? (
              <div className="rounded-2xl border-2 border-ink bg-yellow px-4 py-3 text-sm">
                {notes.map((n) => (
                  <p key={n} className="my-1">
                    {n}
                  </p>
                ))}
              </div>
            ) : null}

            <Details
              details={details}
              setDetails={setDetails}
              save={saveDetails}
              categories={categories}
              rooms={rooms}
              locked={published}
            />

            <div className={card}>
              <h2 className="mt-0 mb-1 font-display text-2xl tracking-[0.02em]">Photos</h2>
              <p className="mt-0 mb-4 text-sm text-ink/70">
                Pick whole-piece shots on a plain background, not room scenes or close-ups. Each photo is cut out as it is added. Tag each one
                with the view it shows.
              </p>
              {draft.candidates?.length ? (
                <>
                  <span className={label}>From the page, click to add</span>
                  <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
                    {draft.candidates.map((url) => (
                      <button
                        key={url}
                        type="button"
                        disabled={published || used.has(url) || Boolean(busy)}
                        onClick={() =>
                          run(`add:${url}`, () =>
                            api(`/drafts/${draft.id}/photos`, {
                              method: "POST",
                              json: { url, angle: byAngle.front ? null : "front" },
                            }),
                          )
                        }
                        className={`relative aspect-square overflow-hidden rounded-xl border-2 bg-white ${used.has(url) ? "border-hot opacity-40" : "border-ink/20 hover:border-ink"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
                        {busy === `add:${url}` ? <span className="absolute inset-0 grid place-items-center bg-white/80 text-xs font-bold">Cutting out…</span> : null}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              {!published ? <AddByLinkOrUpload draft={draft} api={api} run={run} busy={busy} /> : null}

              {photos.length ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {photos.map((photo) => (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      token={token}
                      viewLabels={viewLabels}
                      angles={details.symmetry === "none" ? SHOT_ANGLES : SHOT_ANGLES.filter((a) => !FAR_SIDE.includes(a))}
                      locked={published}
                      isRug={isRug}
                      busy={busy}
                      onChange={(patch) => run(`photo:${photo.id}`, () => api(`/drafts/${draft.id}/photos/${photo.id}`, { method: "PATCH", json: patch }))}
                      onDelete={() => run(`photo:${photo.id}`, () => api(`/drafts/${draft.id}/photos/${photo.id}`, { method: "DELETE" }))}
                      onRug={(kind) =>
                        run(`rug:${photo.id}`, () => api(`/drafts/${draft.id}/rug`, { method: "POST", json: { photoId: photo.id, kind } }))
                      }
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <div className={card}>
              <h2 className="mt-0 mb-1 font-display text-2xl tracking-[0.02em]">Views it needs</h2>
              <p className="mt-0 mb-4 text-sm text-ink/70">
                {isRug
                  ? "Rugs are flat, so their views are warped from one photo. Add a photo taken from above (or a front photo), then use the rug button on it."
                  : "The Studio turns a piece by swapping between these. Two ways to fill in the missing ones from the real photos: draw them all on one view sheet, or build a 3D model and photograph it. Try both and keep whichever looks right. Generate on a single view is the older, prompt-only fallback. Check that a side faces left and a back three-quarter has its end on the left; use Flip if not."}
              </p>
              {draft.plan.error ? <p className="font-bold text-hot">{draft.plan.error}</p> : null}
              {!isRug && !published ? (
                <>
                  <SheetPanel draft={draft} token={token} api={api} run={run} busy={busy} />
                  <MeshPanel draft={draft} token={token} viewLabels={viewLabels} api={api} run={run} busy={busy} />
                </>
              ) : null}
              <ul className="m-0 grid list-none gap-2 p-0">
                {draft.plan.needed.map((angle) => {
                  const have = byAngle[angle];
                  return (
                    <li key={angle} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-ink/15 px-3 py-2">
                      <span className="text-sm font-bold">
                        {have ? "✓" : "○"} {viewLabels[angle]}
                        {have ? <span className="ml-2 font-normal text-ink/60">{have.source}</span> : null}
                      </span>
                      {!have && !published && !isRug && GENERATED.includes(angle) ? (
                        <button
                          type="button"
                          className={`${press} bg-yellow`}
                          disabled={Boolean(busy)}
                          onClick={() => run(`gen:${angle}`, () => api(`/drafts/${draft.id}/generate`, { method: "POST", json: { angle } }))}
                        >
                          {busy === `gen:${angle}` ? "Generating… (about a minute)" : "Generate"}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className={`${card} ${published ? "bg-yellow" : ""}`}>
              {published ? (
                <>
                  <p className="m-0 font-note text-[1.8rem] leading-tight">It is in the catalog.</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <a className={`${press} bg-white no-underline`} href="/pick">
                      See it on Pick
                    </a>
                    <a className={`${press} bg-white no-underline`} href={`/studio?add=${draft.productId}`}>
                      Try it in the Studio
                    </a>
                    <button
                      type="button"
                      className={`${press} bg-white`}
                      disabled={Boolean(busy)}
                      onClick={() => run("unpublish", () => api(`/drafts/${draft.id}/publish`, { method: "DELETE" }))}
                    >
                      Remove from the catalog
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    className={`${press} bg-hot px-6 py-3 font-display text-xl text-white`}
                    disabled={Boolean(busy)}
                    onClick={() => run("publish", () => api(`/drafts/${draft.id}/publish`, { method: "POST" }))}
                  >
                    {busy === "publish" ? "Publishing…" : "Publish"}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-bold text-ink/60 underline underline-offset-4"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      if (window.confirm("Delete this draft and its photos?")) {
                        run("delete", async () => {
                          await api(`/drafts/${draft.id}`, { method: "DELETE" });
                          show(null);
                        });
                      }
                    }}
                  >
                    Delete draft
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Details({ details, setDetails, save, categories, rooms, locked }) {
  const set = (key) => (e) => setDetails({ ...details, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const blur = () => save({});
  const input = (key, text, props = {}) => (
    <label className="block">
      <span className={label}>{text}</span>
      <input className={field} value={details[key] ?? ""} onChange={set(key)} onBlur={blur} disabled={locked} {...props} />
    </label>
  );
  const money = (key, text) => (
    <label className="block">
      <span className={label}>{text}</span>
      <input
        className={field}
        type="number"
        min="0"
        step="0.01"
        value={dollars(details[key])}
        onChange={(e) => setDetails({ ...details, [key]: cents(e.target.value) })}
        onBlur={blur}
        disabled={locked}
      />
    </label>
  );

  return (
    <div className={card}>
      <h2 className="mt-0 mb-4 font-display text-2xl tracking-[0.02em]">Details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {input("name", "Name, with color or finish", { placeholder: "KIVIK sofa, Tallmyra dark green" })}
        {input("addedBy", "Your name")}
        {input("sellerName", "Seller")}
        {input("sellerUrl", "Seller website", { type: "url" })}
        <div className="sm:col-span-2">{input("sourceUrl", "Product link", { type: "url" })}</div>
        <label className="block">
          <span className={label}>Category</span>
          <select className={field} value={details.category} onChange={(e) => save({ category: e.target.value })} disabled={locked}>
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>Room</span>
          <select className={field} value={details.room} onChange={(e) => save({ room: e.target.value })} disabled={locked}>
            <option value="">Choose…</option>
            {rooms.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4">
        {input("widthIn", "Width (in)", { type: "number", min: "0", step: "0.125" })}
        {input("heightIn", "Height (in)", { type: "number", min: "0", step: "0.125" })}
        {input("depthIn", details.category === "rug" ? "Length (in)" : "Depth (in)", { type: "number", min: "0", step: "0.125" })}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        {money("priceCents", "Price ($)")}
        {money("priceMaxCents", "Up to ($), if a range")}
        {money("compareAtCents", "Regular ($), if on sale")}
        {input("quotedOn", "Price seen on", { type: "date" })}
      </div>
      {details.category !== "rug" ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Shape</span>
            <select className={field} value={details.symmetry} onChange={(e) => save({ symmetry: e.target.value })} disabled={locked}>
              {Object.entries(SYMMETRY_HELP).map(([key, help]) => (
                <option key={key} value={key}>
                  {help}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>Camera in the photos</span>
            <select className={field} value={details.altitudeDeg ?? 10} onChange={(e) => save({ altitudeDeg: Number(e.target.value) })} disabled={locked}>
              {ALTITUDES.map(([deg, text]) => (
                <option key={deg} value={deg}>
                  {text}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
            <input type="checkbox" checked={details.againstWall} onChange={(e) => save({ againstWall: e.target.checked })} disabled={locked} />
            Always stands against a wall (beds, consoles, TVs), so it never needs back views
          </label>
        </div>
      ) : null}
    </div>
  );
}

function AddByLinkOrUpload({ draft, api, run, busy }) {
  const [url, setUrl] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-3">
      <form
        className="flex min-w-[260px] flex-1 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const angle = draft.photos.some((p) => p.angle === "front") ? null : "front";
          run("add:url", () => api(`/drafts/${draft.id}/photos`, { method: "POST", json: { url, angle } })).then(() => setUrl(""));
        }}
      >
        <input className={field} type="url" required placeholder="Paste a photo link" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button type="submit" className={`${press} bg-white whitespace-nowrap`} disabled={Boolean(busy)}>
          {busy === "add:url" ? "Cutting out…" : "Add photo"}
        </button>
      </form>
      <label className={`${press} cursor-pointer bg-white ${busy ? "pointer-events-none opacity-50" : ""}`}>
        {busy === "add:file" ? "Cutting out…" : "Upload photos"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={async (e) => {
            const files = [...e.target.files];
            e.target.value = "";
            for (const file of files) {
              const form = new FormData();
              form.set("file", file);
              await run("add:file", () => api(`/drafts/${draft.id}/photos`, { method: "POST", form }));
            }
          }}
        />
      </label>
    </div>
  );
}

function SheetPanel({ draft, token, api, run, busy }) {
  const real = draft.photos.filter((p) => p.angle && (p.source === "retailer" || p.source === "upload"));
  const hasFront = real.some((p) => p.angle === "front");
  const missing = draft.plan.missing.filter((a) => a !== "top");
  const fromSheet = draft.photos.filter((p) => p.angle && p.sheet);
  const redo = draft.plan.needed.filter((a) => a !== "top" && !real.some((p) => p.angle === a));
  const working = busy === "sheet";
  const generate = (angles) => run("sheet", () => api(`/drafts/${draft.id}/sheet`, { method: "POST", json: { angles } }));
  return (
    <div className="mb-4 rounded-2xl border-2 border-ink bg-yellow/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={label}>View sheet</span>
          <p className="m-0 text-sm">
            {!hasFront
              ? "Tag a real front photo first."
              : draft.mesh
                ? "One image call paints every missing view on a single sheet, over renders of the 3D model at each exact angle, so the shapes are right and the views agree. About a minute."
                : "One image call draws every missing view on a single sheet, guided by the piece's box at each angle, so the views agree with each other. Build the 3D model first for exact shapes. About a minute."}
            {fromSheet.length ? ` ${fromSheet.length} view${fromSheet.length === 1 ? "" : "s"} came from the last sheet.` : ""}
            {draft.sheet?.empty?.length ? ` The last sheet left ${draft.sheet.empty.join(", ")} blank.` : ""}
          </p>
        </div>
        {draft.sheet?.url ? (
          <a href={`${draft.sheet.url}?token=${encodeURIComponent(token)}`} target="_blank" rel="noreferrer" title="Open the last sheet">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${draft.sheet.url}?token=${encodeURIComponent(token)}`} alt="Last view sheet" className="h-20 rounded-xl border-2 border-ink object-cover" />
          </a>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={`${press} bg-hot text-white`} disabled={Boolean(busy) || !hasFront || !missing.length} onClick={() => generate(null)}>
          {working ? "Drawing the sheet… (about a minute)" : missing.length ? `Draw the ${missing.length} missing view${missing.length === 1 ? "" : "s"}` : "Nothing missing"}
        </button>
        {redo.length ? (
          <button type="button" className={`${press} bg-white`} disabled={Boolean(busy) || !hasFront} onClick={() => generate(redo)}>
            Redraw all {redo.length}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const TURN_OPTIONS = [
  ["", "Work out from the photos"],
  ["0", "As built"],
  ["90", "Quarter turn"],
  ["180", "Half turn"],
  ["270", "Three-quarter turn"],
];

function MeshPanel({ draft, token, viewLabels, api, run, busy }) {
  const [turn, setTurn] = useState("");
  const mesh = draft.mesh;
  const real = draft.photos.filter((p) => p.angle && (p.source === "retailer" || p.source === "upload"));
  const hasFront = real.some((p) => p.angle === "front");
  const missing = draft.plan.missing.filter((a) => a !== "top");
  const rendered = draft.photos.filter((p) => p.angle && p.rendered);
  const renderable = draft.plan.needed.filter((a) => a !== "top" && !real.some((p) => p.angle === a));
  const building = busy === "mesh:build";
  const rendering = busy === "mesh:render";
  const render = (angles) =>
    run("mesh:render", () => api(`/drafts/${draft.id}/mesh/render`, { method: "POST", json: { angles, turn: turn === "" ? null : Number(turn) } }));

  return (
    <div className="mb-4 rounded-2xl border-2 border-ink bg-sky/15 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={label}>3D model</span>
          {mesh ? (
            <p className="m-0 text-sm">
              Built from the real {mesh.inputs.map((a) => viewLabels[a].toLowerCase()).join(", ")}
              {mesh.model ? ` · ${mesh.model}` : ""}
              {mesh.textured === false ? " · shape only, no texture" : " · textured"}
              {mesh.turn != null ? ` · facing ${mesh.turn}°` : ""}
              {rendered.length ? ` · ${rendered.length} view${rendered.length === 1 ? "" : "s"} rendered` : ""}
              {mesh.note ? <span className="block text-xs text-ink/60">{mesh.note}</span> : null}
            </p>
          ) : (
            <p className="m-0 text-sm">
              {hasFront
                ? "Builds a textured model from the tagged real photos with Hunyuan3D, then renders every missing view straight from it at the piece's exact size. No image model involved; the view sheet can paint over it instead if the texture is not good enough."
                : "Tag a real front photo first. A side and a back help the model too."}
            </p>
          )}
        </div>
        {mesh?.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${mesh.previewUrl}?token=${encodeURIComponent(token)}`} alt="3D model preview" className="h-20 w-20 rounded-xl border-2 border-ink object-cover" />
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!mesh ? (
          <button
            type="button"
            className={`${press} bg-hot text-white`}
            disabled={Boolean(busy) || !hasFront}
            onClick={() => run("mesh:build", () => api(`/drafts/${draft.id}/mesh`, { method: "POST" }))}
          >
            {building ? "Building the model…" : "Build a 3D model"}
          </button>
        ) : (
          <>
            <button type="button" className={`${press} bg-hot text-white`} disabled={Boolean(busy) || !missing.length} onClick={() => render(null)}>
              {rendering ? "Rendering…" : missing.length ? `Render the ${missing.length} missing view${missing.length === 1 ? "" : "s"}` : "Nothing missing"}
            </button>
            <button type="button" className={`${press} bg-white`} disabled={Boolean(busy) || !renderable.length} onClick={() => render(renderable)}>
              Re-render all {renderable.length}
            </button>
            <label className="flex items-center gap-2 text-sm">
              <span className="font-bold">Facing</span>
              <select className={`${field} w-auto py-1.5`} value={turn} onChange={(e) => setTurn(e.target.value)} disabled={Boolean(busy)}>
                {TURN_OPTIONS.map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
            <span className="flex gap-3 text-xs">
              <button
                type="button"
                className="font-bold text-ink underline"
                disabled={Boolean(busy)}
                onClick={() => run("mesh:build", () => api(`/drafts/${draft.id}/mesh`, { method: "POST" }))}
              >
                {building ? "Rebuilding…" : "Rebuild"}
              </button>
              <button
                type="button"
                className="font-bold text-hot underline"
                disabled={Boolean(busy)}
                onClick={() => run("mesh:delete", () => api(`/drafts/${draft.id}/mesh`, { method: "DELETE" }))}
              >
                Remove model
              </button>
            </span>
          </>
        )}
      </div>
      {mesh ? (
        <p className="mt-2 mb-0 text-xs text-ink/60">
          If the renders face the wrong way, pick a different facing and re-render. Renders replace earlier renders of the same view, never real photos.
        </p>
      ) : null}
    </div>
  );
}

function PhotoCard({ photo, token, viewLabels, angles, locked, isRug, busy, onChange, onDelete, onRug }) {
  const [dark, setDark] = useState(false);
  const src = `${photo.cutoutUrl}?token=${encodeURIComponent(token)}`;
  const working = busy === `photo:${photo.id}` || busy === `rug:${photo.id}`;
  return (
    <div className={`overflow-hidden rounded-2xl border-2 ${photo.angle ? "border-ink" : "border-ink/25"}`}>
      <button
        type="button"
        onClick={() => setDark(!dark)}
        title="Switch background to check the edges"
        className={`block aspect-[4/3] w-full ${dark ? "bg-[#2a2622]" : "bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:20px_20px]"}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-contain p-2" style={{ transform: photo.flip ? "scaleX(-1)" : undefined }} />
      </button>
      <div className="grid gap-2 border-t-2 border-ink/10 p-3">
        <div className="flex gap-2">
          <select
            className={`${field} py-1.5`}
            value={photo.angle ?? ""}
            onChange={(e) => onChange({ angle: e.target.value || null })}
            disabled={locked || working}
          >
            <option value="">Not used</option>
            {angles.map((a) => (
              <option key={a} value={a}>
                {viewLabels[a]}
              </option>
            ))}
          </select>
          <button type="button" className={`${press} bg-white px-3 py-1.5`} disabled={locked || working} onClick={() => onChange({ flip: !photo.flip })}>
            Flip
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink/60">
          <span>
            {photo.source}
            {working ? " · working…" : ""}
          </span>
          {!locked ? (
            <span className="flex gap-3">
              {isRug && photo.source !== "warped" ? (
                <>
                  <button type="button" className="font-bold text-ink underline" disabled={Boolean(busy)} onClick={() => onRug("top")}>
                    Rug views from this top photo
                  </button>
                  <button type="button" className="font-bold text-ink underline" disabled={Boolean(busy)} onClick={() => onRug("front")}>
                    …front photo
                  </button>
                </>
              ) : null}
              <button type="button" className="font-bold text-hot underline" disabled={working} onClick={onDelete}>
                Remove
              </button>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

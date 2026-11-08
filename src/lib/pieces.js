import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { openDb, PHOTO_SOURCES, SYMMETRY, withDb } from "./db.js";
import { buildMesh, buildMeshLocally, meshInputViews, meshKey, meshProvider, SPACE_INPUT_VIEWS } from "./mesh.js";
import { fetchImage } from "./scrape.js";
import { neededViews, VIEWS } from "./views.js";

// A draft is a piece someone is still adding: its details, the photos they
// picked or generated, and each photo's cutout. Files live under
// data/pieces/<draft id>/ until publish copies the finished views into
// public/products and writes the catalog rows.

export const PIECES_DIR = path.join(process.cwd(), "data", "pieces");
const PRODUCTS_DIR = path.join(process.cwd(), "public", "products");
const SERVICE = process.env.PIECES_SERVICE_URL ?? "http://127.0.0.1:6022";
const ID = /^[a-z0-9]{12}$/;
// The rug warp's three-quarter turn, in ml/pieces.py.
const RUG_QUARTER_DEG = 34;
const SHOT_ANGLES = Object.keys(VIEWS);
// Views ml/render.py can photograph from a 3D model: every turn, not the top.
const RENDERED_ANGLES = SHOT_ANGLES.filter((angle) => angle !== "top");
// Photos that show the real piece, as opposed to ones we made.
const REAL_SOURCES = ["retailer", "upload"];
export const CATEGORIES = ["sofa", "chair", "stool", "bench", "table", "console", "nightstand", "bed", "tv", "rug", "lamp", "shelf", "other"];
export const ROOMS = ["living", "kitchen", "bedroom"];

export class PieceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** True when the request carries the team token, from a header or ?token=. */
export function allowed(request) {
  const expected = process.env.TEAM_TOKEN;
  if (!expected) return false;
  const url = new URL(request.url);
  const given = request.headers.get("x-team-token") ?? url.searchParams.get("token") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Route handler wrapper: 404 without the token, JSON errors with a status. */
export function teamRoute(fn) {
  return async (request, context) => {
    if (!allowed(request)) return Response.json({ error: "Not found." }, { status: 404 });
    try {
      const params = context?.params ? await context.params : {};
      const result = await fn(request, params);
      return result instanceof Response ? result : Response.json(result);
    } catch (err) {
      const status = err?.status ?? 500;
      if (status >= 500) console.error(err);
      return Response.json({ error: String(err?.message ?? err) }, { status });
    }
  };
}

function draftDir(id) {
  if (!ID.test(id)) throw new PieceError("Not a draft id.", 404);
  return path.join(PIECES_DIR, id);
}

function blankDetails() {
  return {
    name: "",
    sellerName: "",
    sellerUrl: "",
    sourceUrl: "",
    category: "",
    room: "",
    widthIn: null,
    heightIn: null,
    depthIn: null,
    priceCents: null,
    priceMaxCents: null,
    compareAtCents: null,
    quotedOn: new Date().toISOString().slice(0, 10),
    symmetry: "mirror",
    againstWall: false,
    altitudeDeg: 10,
    addedBy: "",
  };
}

function rowToDraft(row) {
  const data = JSON.parse(row.data);
  return { id: row.id, productId: row.product_id ?? null, createdAt: row.created_at, updatedAt: row.updated_at, ...data };
}

function save(db, draft) {
  const { id, productId, createdAt, updatedAt, ...data } = draft;
  db.prepare(
    `UPDATE drafts SET data = ?, product_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
  ).run(JSON.stringify(data), productId ?? null, id);
}

function load(db, id) {
  draftDir(id);
  const row = db.prepare("SELECT * FROM drafts WHERE id = ?").get(id);
  if (!row) throw new PieceError("No draft with that id.", 404);
  return rowToDraft(row);
}

export function listDrafts() {
  const db = openDb();
  try {
    return db
      .prepare("SELECT * FROM drafts ORDER BY updated_at DESC")
      .all()
      .map(rowToDraft)
      .map((draft) => ({
        id: draft.id,
        name: draft.details.name || "Untitled piece",
        addedBy: draft.details.addedBy,
        productId: draft.productId,
        photos: draft.photos.length,
        updatedAt: draft.updatedAt,
      }));
  } finally {
    db.close();
  }
}

export function getDraft(id) {
  const db = openDb();
  try {
    return withPlan(load(db, id));
  } finally {
    db.close();
  }
}

export async function createDraft(input = {}) {
  const id = randomBytes(6).toString("hex");
  await mkdir(draftDir(id), { recursive: true });
  const details = cleanDetails({ ...blankDetails(), ...(input.details ?? {}) });
  const draft = { details, candidates: input.candidates ?? [], photos: [], notes: input.notes ?? [] };
  withDb((db) => db.prepare("INSERT INTO drafts (id, data) VALUES (?, ?)").run(id, JSON.stringify(draft)));
  return getDraft(id);
}

const NUMBER_FIELDS = ["widthIn", "heightIn", "depthIn", "altitudeDeg"];
const CENT_FIELDS = ["priceCents", "priceMaxCents", "compareAtCents"];
const TEXT_FIELDS = ["name", "sellerName", "sellerUrl", "sourceUrl", "category", "room", "quotedOn", "symmetry", "addedBy"];

function cleanDetails(details) {
  const out = { ...details };
  for (const key of TEXT_FIELDS) out[key] = String(out[key] ?? "").trim();
  for (const key of NUMBER_FIELDS) {
    const n = out[key] === "" || out[key] == null ? null : Number(out[key]);
    out[key] = Number.isFinite(n) ? n : null;
  }
  for (const key of CENT_FIELDS) {
    const n = out[key] === "" || out[key] == null ? null : Math.round(Number(out[key]));
    out[key] = Number.isFinite(n) ? n : null;
  }
  out.againstWall = Boolean(out.againstWall);
  return out;
}

export function updateDraft(id, patch) {
  return withDb((db) => {
    const draft = load(db, id);
    if (draft.productId) throw new PieceError("This piece is already in the catalog. Remove it first to edit it.", 409);
    draft.details = cleanDetails({ ...draft.details, ...(patch.details ?? {}) });
    if (draft.details.category === "rug") draft.details.symmetry = "rectangle";
    save(db, draft);
    return withPlan(draft);
  });
}

export async function deleteDraft(id) {
  const draft = getDraft(id);
  if (draft.productId) throw new PieceError("This piece is in the catalog. Remove it from the catalog first.", 409);
  withDb((db) => db.prepare("DELETE FROM drafts WHERE id = ?").run(id));
  await rm(draftDir(id), { recursive: true, force: true });
}

/** Which views the piece still needs, given its symmetry and where it stands. */
function withPlan(draft) {
  let needed = [];
  let planError = null;
  try {
    needed = draft.details.category === "rug" ? ["front", "three-quarter", "front-side", "side"] : neededViews(draft.details.symmetry, draft.details);
  } catch (err) {
    planError = err.message;
  }
  const have = new Set(draft.photos.filter((p) => p.angle).map((p) => p.angle));
  return { ...draft, plan: { needed, missing: needed.filter((a) => !have.has(a)), error: planError } };
}

async function service(route, body) {
  let response;
  try {
    response = await fetch(`${SERVICE}${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new PieceError("The cutout service is not running. Start it with ml/.venv/bin/python ml/pieces.py.", 503);
  }
  const result = await response.json();
  if (!response.ok) throw new PieceError(result.error ?? "The cutout service failed.", response.status);
  return result;
}

function fileUrl(draftId, relative) {
  return `/api/pieces/drafts/${draftId}/files/${relative}`;
}

/** Store an image, cut it out, and attach it to the draft under `angle`. */
async function attach(id, { bytes, ext, angle = null, source, fromUrl = null, flip = false }) {
  if (!PHOTO_SOURCES.includes(source)) throw new PieceError(`Unknown photo source ${source}.`);
  if (angle && !SHOT_ANGLES.includes(angle)) throw new PieceError(`Unknown view ${angle}.`);
  const dir = draftDir(id);
  const photoId = randomBytes(4).toString("hex");
  const original = `sources/${photoId}.${ext}`;
  const cutout = `cutouts/${photoId}.png`;
  await mkdir(path.join(dir, "sources"), { recursive: true });
  await writeFile(path.join(dir, original), bytes);
  const cut = await service("/matte", { src: path.join(dir, original), out: path.join(dir, cutout) });
  return withDb((db) => {
    const draft = load(db, id);
    if (draft.productId) throw new PieceError("This piece is already in the catalog.", 409);
    if (angle) for (const p of draft.photos) if (p.angle === angle) p.angle = null;
    const photo = {
      id: photoId,
      angle,
      source,
      flip,
      fromUrl,
      original,
      cutout,
      originalUrl: fileUrl(id, original),
      cutoutUrl: fileUrl(id, cutout),
      size: [cut.width, cut.height],
    };
    draft.photos.push(photo);
    save(db, draft);
    return withPlan(draft);
  });
}

function extFor(type) {
  if (/png/.test(type)) return "png";
  if (/webp/.test(type)) return "webp";
  return "jpg";
}

export async function addPhotoFromUrl(id, { url, angle }) {
  const { bytes, type } = await fetchImage(url);
  return attach(id, { bytes, ext: extFor(type), angle, source: "retailer", fromUrl: url });
}

export async function addPhotoFromUpload(id, file, angle) {
  if (!file || typeof file === "string") throw new PieceError("Attach a photo.");
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new PieceError("Photos must be JPEG, PNG, or WebP.");
  if (file.size > 25 * 1024 * 1024) throw new PieceError("That photo is over 25 MB.");
  return attach(id, { bytes: Buffer.from(await file.arrayBuffer()), ext: extFor(file.type), angle, source: "upload" });
}

export function updatePhoto(id, photoId, patch) {
  return withDb((db) => {
    const draft = load(db, id);
    if (draft.productId) throw new PieceError("This piece is already in the catalog.", 409);
    const photo = draft.photos.find((p) => p.id === photoId);
    if (!photo) throw new PieceError("No photo with that id.", 404);
    if ("angle" in patch) {
      const angle = patch.angle || null;
      if (angle && !SHOT_ANGLES.includes(angle)) throw new PieceError(`Unknown view ${angle}.`);
      if (angle) for (const p of draft.photos) if (p.angle === angle && p.id !== photoId) p.angle = null;
      photo.angle = angle;
    }
    if ("flip" in patch) photo.flip = Boolean(patch.flip);
    save(db, draft);
    return withPlan(draft);
  });
}

export async function deletePhoto(id, photoId) {
  const draft = withDb((db) => {
    const d = load(db, id);
    if (d.productId) throw new PieceError("This piece is already in the catalog.", 409);
    const photo = d.photos.find((p) => p.id === photoId);
    if (!photo) throw new PieceError("No photo with that id.", 404);
    d.photos = d.photos.filter((p) => p.id !== photoId);
    save(db, d);
    return { d, photo };
  });
  const dir = draftDir(id);
  await Promise.all([draft.photo.original, draft.photo.cutout].map((f) => unlink(path.join(dir, f)).catch(() => {})));
  return withPlan(draft.d);
}

export async function readDraftFile(id, relative) {
  const dir = draftDir(id);
  const full = path.resolve(dir, relative);
  if (!full.startsWith(dir + path.sep)) throw new PieceError("Not a draft file.", 404);
  const bytes = await readFile(full).catch(() => null);
  if (!bytes) throw new PieceError("No such file.", 404);
  const ext = path.extname(full).slice(1);
  return { bytes, type: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg" };
}

// ---- Generated views ----

const VIEW_PROMPTS = {
  front: "seen straight on from the FRONT, square on and centered, both sides symmetrical",
  "three-quarter":
    "seen from the front at a THREE-QUARTER angle: the camera is 45 degrees off to the piece's left, so the front faces toward the left of the image and the piece's left side shows on the right of the image",
  side: "seen from exactly the SIDE, a pure 90-degree profile: the piece's front faces the LEFT edge of the image and its back is on the right",
  "back-three-quarter":
    "seen from BEHIND at a three-quarter angle: the camera stands behind the piece and 45 degrees off to one side, so the back runs at an angle toward the right of the image and one end of the piece is on the left of the image, with the front facing away from the camera",
  back: "seen from DIRECTLY BEHIND, square on and centered, the back of the piece facing the camera",
  "one-quarter":
    "seen from the front at a THREE-QUARTER angle from the piece's RIGHT: the camera is 45 degrees off to the piece's right, so the front faces toward the right of the image and the piece's right side shows on the left of the image",
  "front-side":
    "seen mostly from the SIDE but turned slightly toward the front (67 degrees around from the front): the piece's left end fills most of the view and the front is just visible, receding toward the left of the image",
  "back-side":
    "seen mostly from the SIDE but turned slightly toward the back (112 degrees around from the front): the piece's left end fills most of the view and the back is just visible, receding toward the right of the image",
  "other-front-side":
    "seen mostly from the piece's RIGHT SIDE but turned slightly toward the front (67 degrees around from the front): the piece's right end fills most of the view and the front is just visible, receding toward the right of the image",
  "other-back-side":
    "seen mostly from the piece's RIGHT SIDE but turned slightly toward the back (112 degrees around from the front): the piece's right end fills most of the view and the back is just visible, receding toward the left of the image",
  "other-side":
    "seen from exactly the piece's RIGHT SIDE, a pure 90-degree profile: the piece's front faces the RIGHT edge of the image and its back is on the left",
  "back-one-quarter":
    "seen from BEHIND at a three-quarter angle from the piece's RIGHT: the camera stands behind the piece and 45 degrees off toward its right end, so the back runs at an angle toward the left of the image and the piece's right end is on the right of the image, with the front facing away from the camera",
};

function generatePrompt(details, angle) {
  const d = details;
  return [
    `Studio product packshot of the exact same ${d.name}${d.sellerName ? ` from ${d.sellerName}` : ""} shown in the reference photos, now ${VIEW_PROMPTS[angle]}.`,
    `Camera slightly above the piece, looking down about ${d.altitudeDeg ?? 10} degrees, like the reference photos.`,
    `Same materials, colors, and details. Real proportions: ${d.widthIn} inches wide, ${d.depthIn} inches deep, ${d.heightIn} inches tall.`,
    "Entire piece in frame with margin on every side. Pure white seamless background, soft even studio light, no floor shadow, no props, no text.",
  ].join(" ");
}

export async function generateView(id, angle) {
  if (!VIEW_PROMPTS[angle]) throw new PieceError(`Cannot generate a ${angle} view.`);
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new PieceError("Generating views needs OPENAI_API_KEY in .env.local. You can upload the view instead.", 501);
  const draft = getDraft(id);
  const d = draft.details;
  if (!d.name || !(d.widthIn > 0) || !(d.heightIn > 0) || !(d.depthIn > 0)) {
    throw new PieceError("Fill in the name and the width, height, and depth before generating views.");
  }
  const refs = ["front", "three-quarter", "side"]
    .map((a) => draft.photos.find((p) => p.angle === a))
    .filter(Boolean);
  if (!refs.length) throw new PieceError("Add at least one real photo before generating the other views.");
  const form = new FormData();
  form.set("model", process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-sunburst");
  form.set("prompt", generatePrompt(d, angle));
  form.set("size", /side$/.test(angle) ? "1024x1024" : "1536x1024");
  form.set("quality", "high");
  const dir = draftDir(id);
  for (const ref of refs) {
    const ext = path.extname(ref.original).slice(1);
    const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    form.append("image[]", new Blob([await readFile(path.join(dir, ref.original))], { type }), `${ref.angle}.${ext}`);
  }
  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new PieceError(`The image API said: ${body.error?.message ?? response.statusText}`, 502);
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) throw new PieceError("The image API returned no image.", 502);
  return attach(id, { bytes: Buffer.from(b64, "base64"), ext: "png", angle, source: "generated" });
}

// ---- Rugs ----

/** Warp a rug photo, taken from above or from the front, into its three views. */
export async function makeRugViews(id, photoId, kind) {
  const draft = getDraft(id);
  const d = draft.details;
  if (d.category !== "rug") throw new PieceError("Only rugs are warped. Set the category to rug.");
  if (!(d.widthIn > 0) || !(d.depthIn > 0)) throw new PieceError("Fill in the rug's width and length (depth) first.");
  const photo = draft.photos.find((p) => p.id === photoId);
  if (!photo) throw new PieceError("No photo with that id.", 404);
  const dir = draftDir(id);
  const outDir = path.join(dir, "rug", photoId);
  const { views } = await service("/rug", {
    src: path.join(dir, photo.cutout),
    kind: kind === "front" ? "front" : "top",
    widthIn: d.widthIn,
    lengthIn: d.depthIn,
    outDir,
  });
  return withDb((db) => {
    const current = load(db, id);
    for (const [angle, file] of Object.entries(views)) {
      for (const p of current.photos) if (p.angle === angle) p.angle = null;
      const relative = path.relative(dir, file);
      current.photos.push({
        id: randomBytes(4).toString("hex"),
        angle,
        source: "warped",
        flip: false,
        fromUrl: null,
        original: relative,
        cutout: relative,
        originalUrl: fileUrl(id, relative),
        cutoutUrl: fileUrl(id, relative),
        size: null,
      });
    }
    if (kind !== "front") photo.angle = "top";
    save(db, current);
    return withPlan(current);
  });
}

// ---- 3D model ----
//
// The real photos go to an image-to-3D model (src/lib/mesh.js). The result,
// data/pieces/<id>/mesh/model.glb, is photographed by ml/render.py from any
// view the piece still needs, with the same camera the Studio assumes, so the
// turns agree with each other and with the real front.

function realPhotos(draft) {
  return draft.photos.filter((p) => p.angle && REAL_SOURCES.includes(p.source));
}

const TURNS = [0, 90, 180, 270];

export async function buildDraftMesh(id) {
  const draft = getDraft(id);
  if (draft.productId) throw new PieceError("This piece is already in the catalog.", 409);
  const d = draft.details;
  if (d.category === "rug") throw new PieceError("Rugs are warped from one photo instead; use the rug button on it.");
  if (!(d.widthIn > 0 && d.heightIn > 0 && d.depthIn > 0)) throw new PieceError("Fill in the width, height, and depth before building a 3D model.");
  const real = realPhotos(draft);
  if (!real.some((p) => p.angle === "front")) throw new PieceError("Tag a real front photo before building a 3D model.");
  const provider = await meshProvider();
  if (provider === "fal") meshKey();
  const dir = draftDir(id);
  const meshDir = path.join(dir, "mesh");
  await rm(meshDir, { recursive: true, force: true });
  await mkdir(meshDir, { recursive: true });
  const fitted = {};
  const inputs = [];
  for (const angle of provider === "fal" ? meshInputViews() : SPACE_INPUT_VIEWS) {
    const photo = real.find((p) => p.angle === angle);
    if (!photo) continue;
    const out = path.join(meshDir, `in-${angle}.png`);
    await service("/fit", { src: path.join(dir, photo.cutout), out, maxPx: 1536, flip: Boolean(photo.flip) });
    fitted[angle] = out;
    inputs.push(angle);
  }
  let mesh;
  if (provider === "fal") {
    const images = {};
    for (const [angle, file] of Object.entries(fitted)) images[angle] = await readFile(file);
    const built = await buildMesh(images);
    await writeFile(path.join(meshDir, "model.glb"), built.glb);
    if (built.preview) await writeFile(path.join(meshDir, "preview.png"), built.preview);
    mesh = { model: built.model, textured: true, note: null, previewUrl: built.preview ? fileUrl(id, "mesh/preview.png") : null };
  } else if (provider === "local") {
    const built = await buildMeshLocally(fitted, path.join(meshDir, "model.glb"));
    mesh = { model: "Hunyuan3D-2.1 (local GPU)", textured: built.textured, note: null, previewUrl: null, stats: built.stats ?? null };
  } else {
    const built = await service("/mesh-space", { images: fitted, out: path.join(meshDir, "model.glb"), textured: Boolean(process.env.HF_TOKEN), token: process.env.HF_TOKEN ?? null });
    mesh = { model: "Hunyuan3D-2.1 (Hugging Face Space)", textured: built.textured, note: built.note ?? null, previewUrl: null };
  }
  return withDb((db) => {
    const current = load(db, id);
    current.mesh = { file: "mesh/model.glb", ...mesh, inputs, up: null, turn: null, scores: null, createdAt: new Date().toISOString() };
    save(db, current);
    return withPlan(current);
  });
}

export async function deleteDraftMesh(id) {
  const draft = getDraft(id);
  if (draft.productId) throw new PieceError("This piece is already in the catalog.", 409);
  withDb((db) => {
    const current = load(db, id);
    delete current.mesh;
    save(db, current);
  });
  await rm(path.join(draftDir(id), "mesh"), { recursive: true, force: true });
  return getDraft(id);
}

/**
 * Photograph the 3D model from `angles` (default: the views still missing)
 * and attach the renders as generated photos. The model's facing is worked
 * out from the real photos the first time; `turn` (0, 90, 180, 270) overrides it.
 */
export async function renderDraftMesh(id, { angles = null, turn = null } = {}) {
  const draft = getDraft(id);
  if (draft.productId) throw new PieceError("This piece is already in the catalog.", 409);
  if (!draft.mesh) throw new PieceError("Build a 3D model first.", 409);
  if (turn != null && !TURNS.includes(turn)) throw new PieceError("Turn must be 0, 90, 180, or 270.");
  if (angles) for (const angle of angles) if (!RENDERED_ANGLES.includes(angle)) throw new PieceError(`Cannot render a ${angle} view.`);
  const d = draft.details;
  const real = realPhotos(draft);
  const taken = new Set(real.map((p) => p.angle));
  const wanted = (angles ?? draft.plan.missing).filter((angle) => RENDERED_ANGLES.includes(angle) && !taken.has(angle));
  if (!wanted.length) throw new PieceError("Every view this piece needs already has a real photo.");
  const dir = draftDir(id);
  const outDir = path.join(dir, "renders", Date.now().toString(36));
  const result = await service("/render", {
    glb: path.join(dir, draft.mesh.file),
    outDir,
    angles: wanted,
    altitudeDeg: d.altitudeDeg ?? 10,
    inches: { width: d.widthIn, height: d.heightIn, depth: d.depthIn },
    refs: real.filter((p) => p.angle !== "top").map((p) => ({ angle: p.angle, path: path.join(dir, p.cutout), flip: Boolean(p.flip) })),
    up: draft.mesh.up ?? null,
    turn: turn ?? draft.mesh.turn ?? null,
  });
  const stale = [];
  const updated = withDb((db) => {
    const current = load(db, id);
    if (!current.mesh) throw new PieceError("The 3D model was removed while rendering.", 409);
    stale.push(...replaceMade(current, id, dir, "rendered", wanted, result.views, true));
    const detected = result.scores && Object.keys(result.scores).length;
    current.mesh = { ...current.mesh, up: result.up, turn: result.turn, scores: detected ? result.scores : current.mesh.scores };
    save(db, current);
    return withPlan(current);
  });
  await Promise.all(stale.map((p) => unlink(path.join(dir, p.original)).catch(() => {})));
  return updated;
}

/**
 * Put views we made (`made`: angle -> {path, width, height}) into the draft as
 * generated photos flagged with `flag` ("rendered" or "sheet"). Earlier photos
 * with the same flag for those angles are dropped and returned for unlinking;
 * other photos on those angles are untagged but kept. `trueShape` marks views
 * whose proportions come from the 3D model, so normalize must not restretch them.
 */
function replaceMade(current, id, dir, flag, angles, made, trueShape) {
  const stale = [];
  current.photos = current.photos.filter((p) => {
    if (p[flag] && angles.includes(p.angle)) {
      stale.push(p);
      return false;
    }
    return true;
  });
  for (const p of current.photos) if (p.angle && made[p.angle]) p.angle = null;
  for (const [angle, view] of Object.entries(made)) {
    const relative = path.relative(dir, view.path);
    current.photos.push({
      id: randomBytes(4).toString("hex"),
      angle,
      source: "generated",
      [flag]: true,
      trueShape: Boolean(trueShape),
      flip: false,
      fromUrl: null,
      original: relative,
      cutout: relative,
      originalUrl: fileUrl(id, relative),
      cutoutUrl: fileUrl(id, relative),
      size: [view.width, view.height],
    });
  }
  return stale;
}

// ---- View sheets ----
//
// The other way to fill in views: one image call that draws every missing
// view on a single sheet, guided by a layout of the piece's projected box in
// each panel (ml/sheet.py). Generating the views together keeps them
// consistent with each other, the way sprite tools make 8-direction sheets.

const SHEET_REFS = ["front", "three-quarter", "side", "one-quarter", "other-side", "back"];

function sheetPrompt(d, panels) {
  const done = panels.map((p, i) => (p.photo ? i + 1 : null)).filter(Boolean);
  const todo = panels.map((p, i) => (p.photo ? null : i + 1)).filter(Boolean);
  const clay = panels.some((p) => !p.photo && p.clay);
  const list = (nums) => nums.map((n) => `panel ${n}`).join(", ");
  const lines = [
    `Image 1 is a turntable sheet of the ${d.name}${d.sellerName ? ` from ${d.sellerName}` : ""}: a grid of ${panels.length} numbered panels, each one a step further around the piece. ${list(done)} ${done.length === 1 ? "is" : "are"} already finished with a real photo of the piece. ${list(todo)} ${todo.length === 1 ? "holds" : "hold"} ${
      clay
        ? "a plain gray clay model of this exact piece, already posed at that panel's camera angle with the correct outline, proportions, and perspective."
        : "only a plain gray box with a pink front face: the exact footprint of the piece from that panel's camera angle."
    } The other images are the same real photos, larger.`,
    clay
      ? `Make one image, exactly the same size and grid as Image 1. Keep the finished panels exactly as they are. In each unfinished panel, repaint the clay model as the real piece: keep its outline, pose, size, and position exactly, and give it the real materials, colors, seams, cushions, legs, and details from the photos. Each panel continues the turn from its neighbors.`
      : `Make one image, exactly the same size and grid as Image 1. Keep the finished panels exactly as they are. In each unfinished panel, paint that same real piece seen from the camera angle listed below, filling the panel's box exactly: the same width and height as the box, feet on the box's bottom edge, with its front where the pink face is. Each panel continues the turn from its neighbors.`,
    `Every panel shows the one same piece: same materials, colors, cushions, legs, and details, at the same scale, under the same soft even studio light as the finished panels. Camera about ${d.altitudeDeg ?? 10} degrees above the piece's middle, looking slightly down. Real proportions: ${d.widthIn} inches wide, ${d.depthIn} inches deep, ${d.heightIn} inches tall.`,
    "Pure white background everywhere. Keep the thin gray panel borders exactly where they are, and keep each piece centered in its own panel, even when a row is not full. Do not draw the gray boxes, labels, numbers, floor shadows, or any text. Nothing may cross from one panel into another.",
    ...panels.map((p, i) => `Panel ${i + 1}${p.photo ? " (finished)" : ""}: ${VIEW_PROMPTS[p.angle]}.`),
  ];
  return lines.join(" ");
}

const SHEET_MAX_PANELS = 12;

/** Generate the missing views (or `angles`) on one sheet and attach them. */
export async function generateSheet(id, { angles = null } = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new PieceError("Generating views needs OPENAI_API_KEY in .env.local.", 501);
  const draft = getDraft(id);
  if (draft.productId) throw new PieceError("This piece is already in the catalog.", 409);
  const d = draft.details;
  if (d.category === "rug") throw new PieceError("Rugs are warped from one photo instead; use the rug button on it.");
  if (!d.name || !(d.widthIn > 0) || !(d.heightIn > 0) || !(d.depthIn > 0)) {
    throw new PieceError("Fill in the name and the width, height, and depth before generating views.");
  }
  if (angles) for (const angle of angles) if (!VIEW_PROMPTS[angle]) throw new PieceError(`Cannot generate a ${angle} view.`);
  const real = realPhotos(draft);
  if (!real.some((p) => p.angle === "front")) throw new PieceError("Tag a real front photo before generating a view sheet.");
  const taken = new Set(real.map((p) => p.angle));
  const wanted = (angles ?? draft.plan.missing).filter((angle) => VIEW_PROMPTS[angle] && !taken.has(angle));
  if (!wanted.length) throw new PieceError("Every view this piece needs already has a real photo.");
  // Real views sit in the sheet as finished panels, so it reads as one turn
  // around the piece with gaps to fill. The front always leads; other real
  // views join while there is room. Finished panels are not attached.
  const dir = draftDir(id);
  const anchors = ["front", ...SHEET_REFS.filter((a) => a !== "front" && taken.has(a) && VIEW_PROMPTS[a])].slice(0, Math.max(1, SHEET_MAX_PANELS - wanted.length));
  const panels = [...anchors, ...wanted]
    .map((angle) => {
      const photo = anchors.includes(angle) ? real.find((p) => p.angle === angle) : null;
      return {
        angle,
        azimuth: VIEWS[angle].azimuth,
        label: `${VIEWS[angle].label}, ${VIEWS[angle].azimuth}°`,
        photo: photo ? path.join(dir, photo.cutout) : null,
        flip: Boolean(photo?.flip),
      };
    })
    .sort((a, b) => a.azimuth - b.azimuth);
  const outDir = path.join(dir, "sheets", Date.now().toString(36));
  // With a 3D model, the unfinished panels start as renders of it at the exact angle.
  let clayFrom = null;
  if (draft.mesh) {
    const clay = await service("/render", {
      glb: path.join(dir, draft.mesh.file),
      outDir: path.join(outDir, "clay"),
      angles: wanted,
      altitudeDeg: d.altitudeDeg ?? 10,
      inches: { width: d.widthIn, height: d.heightIn, depth: d.depthIn },
      refs: real.filter((p) => p.angle !== "top").map((p) => ({ angle: p.angle, path: path.join(dir, p.cutout), flip: Boolean(p.flip) })),
      up: draft.mesh.up ?? null,
      turn: draft.mesh.turn ?? null,
    });
    for (const panel of panels) if (clay.views[panel.angle]) panel.clay = clay.views[panel.angle].path;
    clayFrom = { up: clay.up, turn: clay.turn };
  }
  const guidePath = path.join(outDir, "guide.png");
  const guide = await service("/sheet-guide", {
    panels,
    altitudeDeg: d.altitudeDeg ?? 10,
    inches: { width: d.widthIn, height: d.heightIn, depth: d.depthIn },
    out: guidePath,
  });

  const form = new FormData();
  form.set("model", process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-sunburst");
  form.set("prompt", sheetPrompt(d, panels));
  form.set("size", `${guide.size[0]}x${guide.size[1]}`);
  form.set("quality", "high");
  form.append("image[]", new Blob([await readFile(guidePath)], { type: "image/png" }), "layout.png");
  const refs = SHEET_REFS.map((a) => real.find((p) => p.angle === a)).filter(Boolean);
  for (const ref of refs) {
    const ext = path.extname(ref.original).slice(1);
    const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    form.append("image[]", new Blob([await readFile(path.join(dir, ref.original))], { type }), `${ref.angle}.${ext}`);
  }
  const response = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new PieceError(`The image API said: ${body.error?.message ?? response.statusText}`, 502);
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) throw new PieceError("The image API returned no image.", 502);
  const sheetPath = path.join(outDir, "sheet.png");
  await writeFile(sheetPath, Buffer.from(b64, "base64"));

  // Every panel goes to the split so finished ones claim their own piece first.
  const cut = await service("/sheet-split", { sheet: sheetPath, panels: guide.panels, size: guide.size, outDir });
  const stale = [];
  const updated = withDb((db) => {
    const current = load(db, id);
    stale.push(...replaceMade(current, id, dir, "sheet", wanted, cut.views, Boolean(clayFrom)));
    current.sheet = {
      file: path.relative(dir, sheetPath),
      url: fileUrl(id, path.relative(dir, sheetPath)),
      angles: Object.keys(cut.views),
      empty: cut.empty,
      guidedByMesh: Boolean(clayFrom),
      createdAt: new Date().toISOString(),
    };
    if (clayFrom && current.mesh) current.mesh = { ...current.mesh, up: clayFrom.up, turn: clayFrom.turn };
    save(db, current);
    return withPlan(current);
  });
  await Promise.all(stale.map((p) => unlink(path.join(dir, p.original)).catch(() => {})));
  // Keep only sheet folders that still hold an attached view, plus the latest sheet.
  const keep = new Set([path.basename(outDir), ...updated.photos.filter((p) => p.sheet).map((p) => p.original.split("/")[1])]);
  for (const name of await readdir(path.join(dir, "sheets")).catch(() => [])) {
    if (!keep.has(name)) await rm(path.join(dir, "sheets", name), { recursive: true, force: true });
  }
  return updated;
}

// ---- Publish ----

function slugify(name) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .split(/[\s_-]+/)
      .filter(Boolean)
      .slice(0, 4)
      .join("-") || "piece"
  );
}

function problems(d, draft) {
  const out = [];
  if (!d.name) out.push("a name");
  if (!d.sellerName) out.push("the seller");
  if (!/^https?:\/\//.test(d.sellerUrl)) out.push("the seller's website");
  if (!CATEGORIES.includes(d.category)) out.push("a category");
  if (!ROOMS.includes(d.room)) out.push("a room");
  if (!(d.widthIn > 0 && d.heightIn > 0 && d.depthIn > 0)) out.push("width, height, and depth in inches");
  if (!(d.priceCents > 0)) out.push("a price");
  if (d.priceMaxCents != null && d.priceMaxCents < d.priceCents) out.push("a top of the price range above the price");
  if (d.compareAtCents != null && d.compareAtCents <= d.priceCents) out.push("a regular price above the sale price");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.quotedOn)) out.push("the date the price was seen");
  if (!SYMMETRY.includes(d.symmetry)) out.push("a shape");
  if (draft.plan.missing.length) out.push(`these views: ${draft.plan.missing.map((a) => VIEWS[a].label.toLowerCase()).join(", ")}`);
  return out;
}

export async function publishDraft(id) {
  const draft = getDraft(id);
  if (draft.productId) throw new PieceError("This piece is already in the catalog.", 409);
  const d = draft.details;
  const missing = problems(d, draft);
  if (missing.length) throw new PieceError(`Before publishing, add ${missing.join("; ")}.`);

  const db = openDb();
  let slug = slugify(d.name);
  try {
    for (let n = 2; db.prepare("SELECT 1 FROM products WHERE slug = ?").get(slug); n++) slug = `${slugify(d.name)}-${n}`;
  } finally {
    db.close();
  }

  const dir = draftDir(id);
  const shots = draft.photos.filter((p) => p.angle);
  const { written } = await service("/normalize", {
    slug,
    category: d.category,
    inches: { width: d.widthIn, height: d.heightIn, depth: d.depthIn },
    views: shots.map((p) => ({ angle: p.angle, path: path.join(dir, p.cutout), flip: p.flip, generated: p.source === "generated", trueShape: Boolean(p.trueShape) })),
    outDir: PRODUCTS_DIR,
  });

  try {
    const productId = withDb((tx) => {
      let seller = tx.prepare("SELECT id FROM sellers WHERE name = ?").get(d.sellerName);
      if (!seller) {
        const row = tx.prepare("INSERT INTO sellers (name, url) VALUES (?, ?)").run(d.sellerName, d.sellerUrl);
        seller = { id: row.lastInsertRowid };
      }
      const product = tx
        .prepare(
          `INSERT INTO products (seller_id, slug, name, category, room, width_in, height_in, depth_in,
             price_cents, price_max_cents, compare_at_cents, quoted_on, symmetry, source_url, added_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          seller.id, slug, d.name, d.category, d.room, d.widthIn, d.heightIn, d.depthIn,
          d.priceCents, d.priceMaxCents, d.compareAtCents, d.quotedOn, d.symmetry, d.sourceUrl || null, d.addedBy || null,
        );
      const pid = Number(product.lastInsertRowid);
      const insert = tx.prepare(
        `INSERT INTO product_photos (product_id, angle, azimuth_deg, altitude_deg, mirror_of, source, path)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      const ids = new Map();
      const sourceOf = new Map(shots.map((p) => [p.angle, p.source]));
      const altitude = d.category === "rug" ? 30 : d.altitudeDeg ?? 10;
      for (const file of [...written].sort((a, b) => Boolean(a.mirrorOf) - Boolean(b.mirrorOf))) {
        const view = VIEWS[file.angle];
        const rugQuarter = d.category === "rug" && /quarter$/.test(file.angle) && !/^back/.test(file.angle);
        const row = insert.run(
          pid,
          file.angle,
          rugQuarter ? Math.sign(view.azimuth) * RUG_QUARTER_DEG : view.azimuth,
          view.altitude ?? altitude,
          file.mirrorOf ? ids.get(file.mirrorOf) : null,
          file.mirrorOf ? "mirror" : sourceOf.get(file.angle) ?? "unknown",
          path.relative(/* turbopackIgnore: true */ process.cwd(), file.path),
        );
        ids.set(file.angle, Number(row.lastInsertRowid));
      }
      const current = load(tx, id);
      current.productId = pid;
      current.slug = slug;
      save(tx, current);
      return pid;
    });
    return { ...getDraft(id), productId };
  } catch (err) {
    await Promise.all(written.map((f) => unlink(f.path).catch(() => {})));
    throw err;
  }
}

/** Take a published piece back out of the catalog; the draft stays editable. */
export async function unpublishDraft(id) {
  const draft = getDraft(id);
  if (!draft.productId) throw new PieceError("This piece is not in the catalog.", 409);
  const files = withDb((db) => {
    const rows = db.prepare("SELECT path FROM product_photos WHERE product_id = ?").all(draft.productId);
    const current = load(db, id);
    current.productId = null;
    delete current.slug;
    save(db, current);
    db.prepare("DELETE FROM product_photos WHERE product_id = ? AND mirror_of IS NOT NULL").run(draft.productId);
    db.prepare("DELETE FROM product_photos WHERE product_id = ?").run(draft.productId);
    db.prepare("DELETE FROM products WHERE id = ?").run(draft.productId);
    return rows.map((r) => path.join(/* turbopackIgnore: true */ process.cwd(), r.path));
  });
  await Promise.all(files.map((f) => unlink(f).catch(() => {})));
  return getDraft(id);
}

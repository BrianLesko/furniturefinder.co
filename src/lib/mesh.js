// Build a 3D model of a piece from its real photos with a hosted image-to-3D
// model on fal.ai, then hand the GLB to ml/render.py to photograph from every
// view. Set FAL_KEY in .env.local; MESH_MODEL picks the fal endpoint.

export const DEFAULT_MESH_MODEL = "fal-ai/hunyuan-3d/v3.1/pro/image-to-3d";
const QUEUE = "https://queue.fal.run";
const POLL_MS = 4000;
const TIMEOUT_MS = 15 * 60 * 1000;

// Which of our shot views each Hunyuan input slot wants. Camera azimuths are
// positive to the camera's right, which is the piece's left.
const HUNYUAN_SLOTS = {
  front: "input_image_url",
  "three-quarter": "left_front_image_url",
  side: "left_image_url",
  "one-quarter": "right_front_image_url",
  "other-side": "right_image_url",
  back: "back_image_url",
  top: "top_image_url",
};

export class MeshError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

export function meshModel() {
  return process.env.MESH_MODEL || DEFAULT_MESH_MODEL;
}

/**
 * Where models get built: "fal" (paid, textured, Hunyuan3D 3.1 Pro) when
 * FAL_KEY is set, otherwise the free Hunyuan3D-2.1 Space on Hugging Face via
 * ml/hyspace.py, which gives the shape on any quota and textures with a PRO
 * token in HF_TOKEN. MESH_PROVIDER overrides.
 */
export const LOCAL_MESH_URL = process.env.HY3D_LOCAL_URL ?? "http://127.0.0.1:6023";

/** True when the local Hunyuan3D service (ml/hy3d_local.py) is up. */
export async function localMeshUp() {
  try {
    const res = await fetch(`${LOCAL_MESH_URL}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Which image-to-3D backend to use: MESH_PROVIDER forces one ("local", "fal",
 * "space"); otherwise the local GPU service when it is running, then fal when
 * there is a key, then the free Hugging Face Space.
 */
export async function meshProvider() {
  const forced = process.env.MESH_PROVIDER;
  if (forced === "local" || forced === "fal" || forced === "space") return forced;
  if (await localMeshUp()) return "local";
  return process.env.FAL_KEY ? "fal" : "space";
}

/** Build on the local service. images: {angle: fitted png path}. */
export async function buildMeshLocally(images, out, { textured = true } = {}) {
  const res = await fetch(`${LOCAL_MESH_URL}/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images, out, textured }),
    signal: AbortSignal.timeout(30 * 60 * 1000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new MeshError(data.error ?? `Local Hunyuan3D failed (${res.status})`);
  return data;
}

// Our view names for the Space's slots; keep in step with SLOTS in ml/hyspace.py.
export const SPACE_INPUT_VIEWS = ["front", "side", "other-side", "back"];

/** The fal.ai key, or a clear error about where to put it. */
export function meshKey() {
  const key = process.env.FAL_KEY;
  if (!key) throw new MeshError("Building 3D models needs FAL_KEY in .env.local (an api key from fal.ai).", 501);
  return key;
}

/** Views worth sending to the model, best first; the front is required. */
export function meshInputViews(model = meshModel()) {
  return /trellis/i.test(model) ? ["front"] : Object.keys(HUNYUAN_SLOTS);
}

function dataUri(bytes, type = "image/png") {
  return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
}

/** Request body for the chosen model from { angle: pngBytes }. */
export function meshRequest(images, model = meshModel()) {
  if (!images.front) throw new MeshError("A 3D model needs a real front photo.", 400);
  if (/trellis/i.test(model)) {
    return { image_url: dataUri(images.front), texture_size: 2048, decimation_target: 150000 };
  }
  const input = { generate_type: "Normal", enable_pbr: false, face_count: 150000 };
  for (const [angle, slot] of Object.entries(HUNYUAN_SLOTS)) if (images[angle]) input[slot] = dataUri(images[angle]);
  return input;
}

async function falFetch(url, key, init = {}) {
  const response = await fetch(url, { ...init, headers: { Authorization: `Key ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.detail;
    const message = Array.isArray(detail) ? detail.map((d) => d.msg ?? JSON.stringify(d)).join("; ") : detail ?? body.error ?? response.statusText;
    throw new MeshError(`The 3D service said: ${message}`, response.status >= 500 ? 502 : 400);
  }
  return body;
}

/**
 * Run the image-to-3D model and return { glb, preview, model, requestId }.
 * `images` maps our view names to PNG bytes. `onStatus(text)` gets progress.
 */
export async function buildMesh(images, { onStatus = () => {} } = {}) {
  const key = meshKey();
  const model = meshModel();
  const submitted = await falFetch(`${QUEUE}/${model}`, key, { method: "POST", body: JSON.stringify(meshRequest(images, model)) });
  const statusUrl = submitted.status_url ?? `${QUEUE}/${model}/requests/${submitted.request_id}/status`;
  const responseUrl = submitted.response_url ?? `${QUEUE}/${model}/requests/${submitted.request_id}`;
  const started = Date.now();
  for (;;) {
    const status = await falFetch(statusUrl, key);
    onStatus(status.status);
    if (status.status === "COMPLETED") break;
    if (status.status !== "IN_QUEUE" && status.status !== "IN_PROGRESS") throw new MeshError(`The 3D service stopped with ${status.status}.`);
    if (Date.now() - started > TIMEOUT_MS) throw new MeshError("The 3D service took more than 15 minutes.", 504);
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  const result = await falFetch(responseUrl, key);
  const glbUrl = result.model_glb?.url ?? result.model_urls?.glb?.url;
  if (!glbUrl) throw new MeshError("The 3D service returned no model.");
  const glb = await download(glbUrl);
  if (!glb) throw new MeshError("Could not download the 3D model.");
  const preview = result.thumbnail?.url ? await download(result.thumbnail.url) : null;
  return { glb, preview, model, requestId: submitted.request_id ?? null };
}

async function download(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

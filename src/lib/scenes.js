import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

// A scene is one room ready for the final render: the straightened photo,
// the mask of gaps the straighten invented, the cutout mockup, and the
// placements as JSON. It also keeps the photo as taken and the studio's own
// state, so the room can be opened again and edited. Each belongs to the
// account that saved it. The web UI writes them and the MCP servers read them.

export const SCENE_DIR = path.join(process.cwd(), "data", "scenes");
export const SCENE_FILES = { room: "room.png", mask: "mask.png", mockup: "mockup.png", scene: "scene.json" };
const SOURCE_TYPES = { "image/jpeg": "source.jpg", "image/png": "source.png", "image/webp": "source.webp" };

const ID = /^[a-z0-9-]{6,64}$/;

export function sceneDir(id) {
  if (!ID.test(id)) throw new Error(`Not a scene id: ${id}`);
  return path.join(SCENE_DIR, id);
}

export function sourceFileFor(type) {
  return SOURCE_TYPES[type] ?? null;
}

/**
 * Save a scene for `ownerId`. With `id`, replaces that scene when the same
 * owner saved it; otherwise makes a new one.
 */
export async function writeScene({ id, ownerId, room, mask, mockup, source, sourceType, scene }) {
  let existing = null;
  if (id) {
    existing = await readScene(id).catch(() => null);
    if (existing && existing.ownerId !== ownerId) existing = null;
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").toLowerCase();
  const sceneId = existing?.id ?? `${stamp}-${randomBytes(3).toString("hex")}`;
  const dir = sceneDir(sceneId);
  if (existing) await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, SCENE_FILES.room), room);
  await writeFile(path.join(dir, SCENE_FILES.mockup), mockup);
  if (mask) await writeFile(path.join(dir, SCENE_FILES.mask), mask);
  const sourceFile = source ? sourceFileFor(sourceType) : null;
  if (sourceFile) await writeFile(path.join(dir, sourceFile), source);
  const now = new Date().toISOString();
  const record = {
    ...scene,
    id: sceneId,
    ownerId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    hasMask: Boolean(mask),
    sourceFile,
  };
  await writeFile(path.join(dir, SCENE_FILES.scene), JSON.stringify(record, null, 2));
  return record;
}

export async function readScene(id) {
  const dir = sceneDir(id);
  return JSON.parse(await readFile(path.join(dir, SCENE_FILES.scene), "utf8"));
}

/** One owner's scene, or null when it is missing or someone else's. */
export async function readOwnScene(id, ownerId) {
  const scene = await readScene(id).catch(() => null);
  return scene && scene.ownerId === ownerId ? scene : null;
}

export async function deleteScene(id, ownerId) {
  if (!(await readOwnScene(id, ownerId))) return false;
  await rm(sceneDir(id), { recursive: true, force: true });
  return true;
}

/** Scenes newest first; only `ownerId`'s when given. */
export async function listScenes({ ownerId } = {}) {
  let names = [];
  try {
    names = await readdir(SCENE_DIR);
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
  const scenes = [];
  for (const name of names) {
    if (!ID.test(name)) continue;
    try {
      await stat(path.join(SCENE_DIR, name, SCENE_FILES.scene));
      const scene = await readScene(name);
      if (ownerId == null || scene.ownerId === ownerId) scenes.push(scene);
    } catch {
      continue;
    }
  }
  return scenes.sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));
}

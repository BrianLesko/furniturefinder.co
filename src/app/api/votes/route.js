import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { BEST } from "@/lib/straighten-methods";

export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "data", "votes", "votes.json");
const VOTES = new Set(["yes", "no"]);
const ID = /^[a-z0-9@._-]{1,80}$/i;

let queue = Promise.resolve();

async function readVotes() {
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    return {};
  }
}

export async function GET() {
  return Response.json(await readVotes());
}

/**
 * Body: { photo, method, vote: "yes" | "no" | null }, or { photo, method: "best",
 * vote: <method id> | null } for the photo's best result. A null vote clears it.
 */
export async function POST(request) {
  const { photo, method, vote } = await request.json().catch(() => ({}));
  const valid = vote === null || (method === BEST ? ID.test(vote ?? "") : VOTES.has(vote));
  if (!ID.test(photo ?? "") || !ID.test(method ?? "") || !valid) {
    return Response.json({ error: "Send a photo id, a method id and a yes, no or null vote." }, { status: 400 });
  }
  const task = queue.then(async () => {
    const votes = await readVotes();
    const entry = { ...votes[photo] };
    if (vote === null) delete entry[method];
    else entry[method] = vote;
    if (Object.keys(entry).length) votes[photo] = entry;
    else delete votes[photo];
    await mkdir(path.dirname(FILE), { recursive: true });
    await writeFile(`${FILE}.tmp`, JSON.stringify(votes, null, 1));
    await rename(`${FILE}.tmp`, FILE);
    return votes;
  });
  queue = task.catch(() => {});
  return Response.json(await task);
}

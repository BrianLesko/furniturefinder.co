import { readFile } from "node:fs/promises";
import path from "node:path";
import { rankMethods } from "@/lib/ranking";

export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "data", "votes", "votes.json");

export async function GET(request) {
  let votes = {};
  try {
    votes = JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    votes = {};
  }
  const includeRetired = new URL(request.url).searchParams.has("retired");
  return Response.json(rankMethods(votes, { includeRetired }));
}

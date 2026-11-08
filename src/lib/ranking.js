import { BEST, NOT_ROOM, STRAIGHTEN_METHODS } from "./straighten-methods";

const DRAWS = 4000;
const MIN_PICKS = 10;
const CONFIDENT = 0.95;
const RETIRE_BELOW = 0.01;
const RETIRE_MIN_VOTES = 15;

/**
 * Rank straightening methods from votes.
 *
 * Yays say a result is acceptable; each method's yay rate gets a
 * Beta(1 + yays, 1 + nays) posterior, and sampling them together gives each
 * method's chance of having the best true rate, so 3 of 3 does not beat 40 of
 * 50. Several methods are often acceptable on the same photo, so a per-photo
 * "best" pick breaks those ties: once MIN_PICKS photos have one, the ranking
 * uses each method's chance of being picked most often (a Dirichlet over pick
 * counts) instead.
 *
 * @param {Record<string, Record<string, string>>} votes photo id -> method id -> "yes" | "no",
 *   plus `best` -> method id and `not-room` -> "yes"
 */
export function rankMethods(votes, { methods = STRAIGHTEN_METHODS, includeRetired = false } = {}) {
  const photos = Object.values(votes).filter((entry) => entry[NOT_ROOM] !== "yes");
  const pool = methods.filter((m) => includeRetired || m.status === "active");
  const rows = pool.map((method) => {
    let yes = 0;
    let no = 0;
    for (const entry of photos) {
      if (entry[method.id] === "yes") yes++;
      else if (entry[method.id] === "no") no++;
    }
    return { ...method, yes, no, votes: yes + no, rate: (yes + 1) / (yes + no + 2) };
  });

  const picked = photos.filter((entry) => pool.some((m) => m.id === entry[BEST]));
  for (const row of rows) row.picks = picked.filter((entry) => entry[BEST] === row.id).length;
  const basis = picked.length >= MIN_PICKS ? "picks" : "yays";

  const random = mulberry32(0x5eed);
  const draws = rows.map(() => new Float64Array(DRAWS));
  const best = rows.map(() => 0);
  const mostPicked = rows.map(() => 0);
  for (let d = 0; d < DRAWS; d++) {
    let top = 0;
    let pick = 0;
    const shares = rows.map((row) => sampleGamma(1 + row.picks, random));
    rows.forEach((row, i) => {
      draws[i][d] = sampleBeta(1 + row.yes, 1 + row.no, random);
      if (draws[i][d] > draws[top][d]) top = i;
      if (shares[i] > shares[pick]) pick = i;
    });
    best[top]++;
    mostPicked[pick]++;
  }
  rows.forEach((row, i) => {
    const sorted = Array.from(draws[i]).sort((a, b) => a - b);
    row.low = sorted[Math.floor(DRAWS * 0.05)];
    row.high = sorted[Math.floor(DRAWS * 0.95)];
    row.pBest = best[i] / DRAWS;
    row.pMostPicked = mostPicked[i] / DRAWS;
    row.chance = basis === "picks" ? row.pMostPicked : row.pBest;
  });
  rows.sort((a, b) => b.chance - a.chance || b.rate - a.rate);

  const leader = rows[0];
  for (const row of rows) {
    row.verdict =
      row === leader
        ? leader.chance >= CONFIDENT
          ? "use in production"
          : "leading"
        : row.votes >= RETIRE_MIN_VOTES && row.chance < RETIRE_BELOW
          ? "retire"
          : "keep testing";
    row.vsLeader = row === leader ? null : headToHead(photos, row.id, leader.id);
  }

  const covered = photos.filter((entry) => rows.some((row) => entry[row.id] === "yes")).length;
  const judged = photos.filter((entry) => rows.some((row) => entry[row.id])).length;
  return {
    rows,
    leader: leader?.id ?? null,
    basis,
    picked: picked.length,
    photos: judged,
    notRooms: Object.values(votes).length - photos.length,
    // Share of photos where some method got a yay: the ceiling if each photo
    // could be routed to its best method.
    bestPossible: judged ? covered / judged : 0,
  };
}

/** Production pick: the leader, or `fallback` until some method has votes. */
export function productionMethod(votes, fallback = "original-v1") {
  const { rows } = rankMethods(votes);
  return rows[0]?.votes ? rows[0].id : fallback;
}

/**
 * The best-ranked method a page can actually run. `supported` maps method ids
 * to the page's own option ids; returns the option and the row it came from,
 * or null when nothing ranked is supported or nothing has votes.
 *
 * @param {{rows: Array<{id: string, votes: number}>}} ranking from rankMethods
 * @param {Record<string, string>} supported
 */
export function bestSupported(ranking, supported) {
  const row = ranking?.rows?.find((r) => r.votes > 0 && supported[r.id]);
  return row ? { option: supported[row.id], row } : null;
}

/** Photos where `a` got a yay and `b` a nay count as wins for `a`. */
function headToHead(photos, a, b) {
  const result = { wins: 0, losses: 0, ties: 0 };
  for (const entry of photos) {
    if (!entry[a] || !entry[b]) continue;
    if (entry[a] === entry[b]) result.ties++;
    else if (entry[a] === "yes") result.wins++;
    else result.losses++;
  }
  return result;
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleGamma(shape, random) {
  // Marsaglia and Tsang; shapes here are always at least 1.
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x;
    let v;
    do {
      const u1 = random() || 1e-12;
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * random());
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = random();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function sampleBeta(a, b, random) {
  const x = sampleGamma(a, random);
  return x / (x + sampleGamma(b, random));
}

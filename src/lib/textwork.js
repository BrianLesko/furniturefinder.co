import { DatabaseSync } from "node:sqlite";
import { createClient } from "redis";
import { normalizePhone } from "./auth.js";

// Phone sign in rides textwork.co's signup page for the Furniture Finder
// company. The visitor texts a code to textwork's Sendblue line; textwork's
// do-report sees it, files the sender as a contact, and marks the code
// verified in Redis. The sender's number is the proof, so the phone is read
// from that contact, on this same box.

const TEXTWORK_URL = process.env.TEXTWORK_URL || "http://localhost:3000";
const SIGNUP_SLUG = process.env.TEXTWORK_SIGNUP_SLUG || "furniture-finder";
const COMPANY_ID = Number(process.env.TEXTWORK_COMPANY_ID || 68);
const TEXTWORK_DB = process.env.TEXTWORK_DB || "/home/lesko/textwork.co/quantumcodex.db";

let redis;
async function redisClient() {
  if (!redis) {
    redis = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
    redis.on("error", (err) => console.error("Redis:", err.message));
    await redis.connect();
  }
  return redis;
}

function readTextwork(fn) {
  const db = new DatabaseSync(TEXTWORK_DB, { readOnly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

// textwork matches a signup to a row by the sender's phone, then the typed
// email, and only rewrites the phone on contact rows. A team member's email
// would match their row whoever texted, so it goes in as this stand-in, and
// their row can then only be found by their own phone.
const TEAM_EMAIL_STANDIN = "phone-sign-in@furniturefinder.co";

/** Text a sign-in code from textwork's line, through its Sendblue worker. */
export async function textLoginCode(phone, code) {
  const content = `${code} is your Furniture Finder sign-in code. It works for 15 minutes.\n\n@furniturefinder.co #${code}`;
  await (await redisClient()).rPush("blue:outbound", JSON.stringify({ phone, content, ts: Date.now() }));
}

/** `{ code, smsNumber, sentEmail }` to text in, or `{ error, status }`. */
export async function startPhoneSignup(name, typedEmail) {
  const team = readTextwork((db) =>
    db.prepare("SELECT 1 FROM users WHERE company_id = ? AND is_external = 0 AND LOWER(email) = LOWER(?)").get(COMPANY_ID, typedEmail),
  );
  const email = team ? TEAM_EMAIL_STANDIN : typedEmail;
  try {
    const response = await fetch(`${TEXTWORK_URL}/api/public/external-signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: SIGNUP_SLUG, name, email }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.code) return { error: body.error || "Texting isn't available right now.", status: response.ok ? 502 : response.status };
    return { code: body.code, smsNumber: body.smsNumber, sentEmail: email };
  } catch (err) {
    console.error("textwork signup failed:", err);
    return { error: "Texting isn't available right now. Use email instead.", status: 502 };
  }
}

/**
 * "pending", "expired", "refused", or "verified" with the sender's phone. A
 * team row's phone is proof only when the email sent to textwork couldn't
 * have been what matched it.
 */
export async function phoneSignupResult(code, sentEmail) {
  const client = await redisClient();
  const done = await client.get(`extsignup:status:${code}`);
  if (!done) return { status: (await client.exists(`extsignup:code:${code}`)) ? "pending" : "expired" };

  let userId;
  try {
    userId = JSON.parse(done).userId;
  } catch {
    return { status: "expired" };
  }
  const row = readTextwork((db) => db.prepare("SELECT phone, email, is_external FROM users WHERE user_id = ? AND company_id = ?").get(userId, COMPANY_ID));
  const matchedByPhone = row && (row.is_external || String(row.email ?? "").toLowerCase() !== String(sentEmail ?? "").toLowerCase());
  const phone = matchedByPhone ? normalizePhone(row.phone) : null;
  return phone ? { status: "verified", phone } : { status: "refused" };
}

import crypto from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// Passwordless sign in, after textwork.co: an email with a 15 minute link and
// a 6-digit code, or a code texted to textwork's line (see textwork.js), then a
// 30 day session cookie. An account has an email, a phone, or both.

export const SESSION_COOKIE = "ff_session";
export const SESSION_DAYS = 30;
const LINK_MINUTES = 15;
const MAX_ATTEMPTS = 8;
const RESEND_COOLDOWN_SECONDS = 30;
const SENDS_PER_HOUR = 6;

const DB_PATH = path.join(process.cwd(), "data", "accounts.db");

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    name TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    last_login_at TEXT
  );

  -- Keyed by an email, or by a phone for codes sent by text.
  CREATE TABLE IF NOT EXISTS login_codes (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    back TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL,
    sent_at INTEGER NOT NULL,
    hour_started_at INTEGER NOT NULL,
    hour_sends INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    prefix TEXT NOT NULL,
    hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    last_used_at TEXT
  );
`;

// Billing columns, added to accounts made before billing.
const USER_COLUMNS = {
  stripe_customer_id: "TEXT",
  subscription_id: "TEXT",
  subscription_status: "TEXT",
  current_period_end: "INTEGER",
};

// Accounts made before phone sign in required an email. SQLite can't drop a
// NOT NULL, so the table is rebuilt once, keeping ids for api_keys.
function allowPhoneOnly(db) {
  const columns = db.prepare("PRAGMA table_info(users)").all();
  if (!columns.find((c) => c.name === "email")?.notnull) return;
  const keep = columns.map((c) => c.name).join(", ");
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("BEGIN");
  try {
    db.exec(`CREATE TABLE users_next (
      id INTEGER PRIMARY KEY,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      name TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      last_login_at TEXT,
      ${Object.entries(USER_COLUMNS).map(([name, type]) => `${name} ${type}`).join(", ")}
    )`);
    db.exec(`INSERT INTO users_next (${keep}) SELECT ${keep} FROM users`);
    db.exec("DROP TABLE users");
    db.exec("ALTER TABLE users_next RENAME TO users");
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

export function withAccounts(fn) {
  const db = new DatabaseSync(DB_PATH);
  try {
    db.exec(SCHEMA);
    const have = new Set(db.prepare("PRAGMA table_info(users)").all().map((c) => c.name));
    for (const [name, type] of Object.entries(USER_COLUMNS)) {
      if (!have.has(name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
    }
    allowPhoneOnly(db);
    if (!db.prepare("PRAGMA table_info(login_codes)").all().some((c) => c.name === "link_id")) {
      db.exec("ALTER TABLE login_codes ADD COLUMN link_id INTEGER");
    }
    return fn(db);
  } finally {
    db.close();
  }
}

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not configured");
  return value;
}

export function normalizeEmail(email) {
  const value = String(email ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254 ? value : null;
}

/** Only paths on this site, so a login link cannot send anyone elsewhere. */
export function safeBack(back) {
  const value = String(back ?? "");
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/dashboard";
}

const b64 = (value) => Buffer.from(value).toString("base64url");

function sign(payload) {
  const body = b64(JSON.stringify(payload));
  const mac = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verify(token, type) {
  const [body, mac] = String(token ?? "").split(".");
  if (!body || !mac) return null;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.type !== type) return null;
    if (!(payload.exp > Date.now())) return { expired: true };
    return payload;
  } catch {
    return null;
  }
}

/**
 * A fresh code and link token for `email` (or a phone), or `{ error: "wait" }` when one
 * was just sent or the hour's sends are used up. The same code stands until
 * it expires, so a resent email matches the first.
 */
export function startLogin(email, back, linkId = null) {
  const now = Date.now();
  return withAccounts((db) => {
    const row = db.prepare("SELECT * FROM login_codes WHERE email = ?").get(email);
    const live = row && row.expires_at > now;
    if (live && now - row.sent_at < RESEND_COOLDOWN_SECONDS * 1000) return { error: "wait" };
    const newHour = !row || now - row.hour_started_at >= 3600 * 1000;
    if (!newHour && row.hour_sends >= SENDS_PER_HOUR) return { error: "wait" };
    const code = live ? row.code : String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    db.prepare(
      `INSERT INTO login_codes (email, code, back, link_id, attempts, expires_at, sent_at, hour_started_at, hour_sends)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, 1)
       ON CONFLICT (email) DO UPDATE SET code = excluded.code, back = excluded.back, link_id = excluded.link_id, attempts = 0,
         expires_at = excluded.expires_at, sent_at = excluded.sent_at,
         hour_started_at = ?, hour_sends = ?`,
    ).run(
      email,
      code,
      back,
      linkId,
      now + LINK_MINUTES * 60 * 1000,
      now,
      now,
      newHour ? now : row.hour_started_at,
      newHour ? 1 : row.hour_sends + 1,
    );
    const token = sign({ type: "link", email, back, linkId, exp: now + LINK_MINUTES * 60 * 1000 });
    return { code, token };
  });
}

/** `{ ok, back }` for the right code; otherwise the reason it failed. */
export function checkCode(email, code) {
  const now = Date.now();
  return withAccounts((db) => {
    const row = db.prepare("SELECT * FROM login_codes WHERE email = ?").get(email);
    if (!row || row.expires_at <= now) return { ok: false, error: "expired" };
    const given = Buffer.from(String(code));
    const stored = Buffer.from(row.code);
    if (given.length !== stored.length || !crypto.timingSafeEqual(given, stored)) {
      if (row.attempts + 1 >= MAX_ATTEMPTS) {
        db.prepare("DELETE FROM login_codes WHERE email = ?").run(email);
        return { ok: false, error: "locked" };
      }
      db.prepare("UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?").run(email);
      return { ok: false, error: "invalid" };
    }
    db.prepare("DELETE FROM login_codes WHERE email = ?").run(email);
    return { ok: true, back: row.back, linkId: row.link_id };
  });
}

/** The email and destination in a login link, or why it cannot be used. */
export function readLinkToken(token) {
  const payload = verify(token, "link");
  if (!payload) return { error: "invalid" };
  if (payload.expired) return { error: "expired" };
  return { email: payload.email, back: safeBack(payload.back), linkId: payload.linkId ?? null };
}

/**
 * The account for a verified email or phone, and its session cookie value.
 * `linkId` is an account that asked to add this email or phone, and gets it
 * unless another account already has it; then that account is signed into.
 */
function signInBy(column, value, linkId, name = null) {
  const id = withAccounts((db) => {
    const owner = db.prepare(`SELECT id FROM users WHERE ${column} = ?`).get(value);
    const linking = !owner && linkId ? db.prepare("SELECT id, email, phone FROM users WHERE id = ?").get(linkId) : null;
    const id = owner?.id ?? (linking && !linking[column] ? linking.id : null);
    if (id) {
      db.prepare(`UPDATE users SET ${column} = ?, name = COALESCE(name, ?), last_login_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`).run(
        value,
        name,
        id,
      );
      return id;
    }
    return db
      .prepare(`INSERT INTO users (${column}, name, last_login_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) RETURNING id`)
      .get(value, name).id;
  });
  return sign({ type: "session", uid: id, exp: Date.now() + SESSION_DAYS * 86400 * 1000 });
}

export function signIn(email, linkId = null) {
  withAccounts((db) => db.prepare("DELETE FROM login_codes WHERE email = ?").run(email));
  return signInBy("email", email, linkId);
}

export function signInPhone(phone, name, linkId = null) {
  return signInBy("phone", phone, linkId, name || null);
}

/** The signed-in account id for a session cookie value, or null. */
export function readSession(value) {
  const payload = verify(value, "session");
  if (!payload || payload.expired) return null;
  if (payload.uid) return { id: payload.uid };
  // Sessions from before phone sign in carry the email.
  const row = payload.email && withAccounts((db) => db.prepare("SELECT id FROM users WHERE email = ?").get(payload.email));
  return row ? { id: row.id } : null;
}

/** The full account row for a session cookie value, or null. */
export function sessionUser(value) {
  const session = readSession(value);
  return session ? withAccounts((db) => db.prepare("SELECT * FROM users WHERE id = ?").get(session.id) ?? null) : null;
}

export function phoneHasAccount(phone) {
  return Boolean(withAccounts((db) => db.prepare("SELECT 1 FROM users WHERE phone = ?").get(phone)));
}

/** "+16145551234" from the ways a US number is written; other countries keep their digits. */
export function normalizePhone(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function formatPhone(phone) {
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phone ?? "");
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : (phone ?? "");
}

/** What to call an account: its email, else its phone. */
export const accountLabel = (user) => user?.email || formatPhone(user?.phone) || "";

// A pending text-in code, held in a cookie so only the browser that asked for
// it can collect the sign in.
export const PHONE_COOKIE = "ff_phone";
export const PHONE_MINUTES = 30;

export function phonePendingCookie({ code, smsNumber, name, email, back, linkId }, secure) {
  return {
    name: PHONE_COOKIE,
    value: sign({ type: "phone", code, smsNumber, name, email, back, linkId, exp: Date.now() + PHONE_MINUTES * 60 * 1000 }),
    path: "/api/auth/phone",
    maxAge: PHONE_MINUTES * 60,
    httpOnly: true,
    secure,
    sameSite: "lax",
  };
}

export function readPhonePending(value) {
  const payload = verify(value, "phone");
  return payload && !payload.expired ? payload : null;
}

export function sessionCookie(value, secure) {
  return {
    name: SESSION_COOKIE,
    value,
    path: "/",
    maxAge: SESSION_DAYS * 86400,
    httpOnly: true,
    secure,
    sameSite: "lax",
  };
}

// Keys an AI app sends to the MCP server. Only a hash is kept, so a key is
// shown once, when it is made.
const KEY_PREFIX = "ff_";
const hashKey = (key) => crypto.createHash("sha256").update(key).digest("hex");

export function createApiKey(userId, name) {
  const key = `${KEY_PREFIX}${crypto.randomBytes(24).toString("base64url")}`;
  const label = String(name ?? "").trim().slice(0, 60) || "My AI";
  const row = withAccounts((db) =>
    db
      .prepare("INSERT INTO api_keys (user_id, name, prefix, hash) VALUES (?, ?, ?, ?) RETURNING id, name, prefix, created_at, last_used_at")
      .get(userId, label, key.slice(0, KEY_PREFIX.length + 6), hashKey(key)),
  );
  return { key, record: row };
}

export function listApiKeys(userId) {
  return withAccounts((db) =>
    db.prepare("SELECT id, name, prefix, created_at, last_used_at FROM api_keys WHERE user_id = ? ORDER BY id DESC")
      .all(userId)
      .map((row) => ({ ...row })),
  );
}

export function revokeApiKey(userId, id) {
  return withAccounts((db) => db.prepare("DELETE FROM api_keys WHERE id = ? AND user_id = ?").run(id, userId).changes > 0);
}

/** The account a key belongs to, or null. Marks the key as used. */
export function userForApiKey(key) {
  if (!String(key ?? "").startsWith(KEY_PREFIX)) return null;
  return withAccounts((db) => {
    const row = db
      .prepare("SELECT users.id, users.email, users.phone, users.subscription_status, api_keys.id AS key_id FROM api_keys JOIN users ON users.id = api_keys.user_id WHERE hash = ?")
      .get(hashKey(key));
    if (!row) return null;
    db.prepare("UPDATE api_keys SET last_used_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?").run(row.key_id);
    return { id: row.id, email: row.email, phone: row.phone, subscription_status: row.subscription_status };
  });
}

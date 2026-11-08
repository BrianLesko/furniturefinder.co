import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const DB_PATH = path.join(process.cwd(), "data", "furniture.db");

// What a piece looks like after turning it, so views can stand in for each
// other. mirror: left and right match. rectangle: also front and back match.
// square: every quarter turn matches too. round: every turn matches.
export const SYMMETRY = ["none", "mirror", "rectangle", "square", "round"];

// Where a photo came from. mirror files are flips of another row.
export const PHOTO_SOURCES = ["retailer", "generated", "warped", "mirror", "upload", "unknown"];

const list = (values) => values.map((value) => `'${value}'`).join(", ");

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS sellers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES sellers(id),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    room TEXT NOT NULL,
    width_in REAL NOT NULL,
    height_in REAL NOT NULL,
    depth_in REAL NOT NULL,
    price_cents INTEGER NOT NULL,
    price_max_cents INTEGER,
    compare_at_cents INTEGER,
    quoted_on TEXT NOT NULL,
    symmetry TEXT NOT NULL CHECK (symmetry IN (${list(SYMMETRY)})),
    source_url TEXT,
    added_by TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CHECK (width_in > 0 AND height_in > 0 AND depth_in > 0),
    CHECK (price_cents > 0),
    CHECK (price_max_cents IS NULL OR price_max_cents >= price_cents),
    CHECK (compare_at_cents IS NULL OR compare_at_cents > price_cents)
  );

  CREATE TABLE IF NOT EXISTS product_photos (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    angle TEXT NOT NULL,
    azimuth_deg REAL NOT NULL CHECK (azimuth_deg > -180 AND azimuth_deg <= 180),
    altitude_deg REAL NOT NULL CHECK (altitude_deg >= 0 AND altitude_deg <= 90),
    mirror_of INTEGER REFERENCES product_photos(id),
    source TEXT NOT NULL DEFAULT 'unknown' CHECK (source IN (${list(PHOTO_SOURCES)})),
    path TEXT NOT NULL,
    UNIQUE (product_id, angle, altitude_deg),
    UNIQUE (product_id, azimuth_deg, altitude_deg)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS login_codes (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    back TEXT NOT NULL DEFAULT '/studio',
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL,
    sent_at INTEGER NOT NULL,
    sends_this_hour INTEGER NOT NULL DEFAULT 1,
    hour_started_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    product_id INTEGER REFERENCES products(id),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
`;

export function openDb({ readOnly = false } = {}) {
  const db = new DatabaseSync(DB_PATH, { readOnly, enableForeignKeyConstraints: true });
  if (!readOnly) db.exec(SCHEMA);
  return db;
}

/** Run `fn(db)` inside one transaction and close the connection after. */
export function withDb(fn) {
  const db = openDb();
  try {
    db.exec("BEGIN IMMEDIATE");
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (err) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw err;
  } finally {
    db.close();
  }
}

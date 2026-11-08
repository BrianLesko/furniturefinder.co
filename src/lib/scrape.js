import { lookup } from "node:dns/promises";
import net from "node:net";

// Pull what we can from a retailer's product page: name, price, seller,
// dimension guesses, and candidate photos. Retailers change their pages and
// some block servers outright, so everything here is a starting point the
// person adding the piece confirms.

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const MAX_PAGE = 6 * 1024 * 1024;
const MAX_IMAGE = 25 * 1024 * 1024;

const SELLERS = [
  [/(^|\.)ikea\.com$/, "IKEA", "https://www.ikea.com/us/en/"],
  [/(^|\.)westelm\.com$/, "West Elm", "https://www.westelm.com/"],
  [/(^|\.)potterybarn\.com$/, "Pottery Barn", "https://www.potterybarn.com/"],
  [/(^|\.)amazon\.com$/, "Amazon", "https://www.amazon.com/"],
  [/(^|\.)crateandbarrel\.com$/, "Crate & Barrel", "https://www.crateandbarrel.com/"],
  [/(^|\.)bestbuy\.com$/, "Best Buy", "https://www.bestbuy.com/"],
  [/(^|\.)rugsusa\.com$/, "Rugs USA", "https://www.rugsusa.com/"],
  [/(^|\.)wayfair\.com$/, "Wayfair", "https://www.wayfair.com/"],
  [/(^|\.)target\.com$/, "Target", "https://www.target.com/"],
  [/(^|\.)article\.com$/, "Article", "https://www.article.com/"],
  [/(^|\.)cb2\.com$/, "CB2", "https://www.cb2.com/"],
];

function privateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:");
}

async function publicUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw Object.assign(new Error("That is not a link."), { status: 400 });
  }
  if (!["http:", "https:"].includes(url.protocol)) throw Object.assign(new Error("Links must start with http or https."), { status: 400 });
  const addresses = await lookup(url.hostname, { all: true }).catch(() => []);
  if (!addresses.length) throw Object.assign(new Error(`Could not find ${url.hostname}.`), { status: 400 });
  if (addresses.some((a) => privateAddress(a.address))) throw Object.assign(new Error("That link points inside this network."), { status: 400 });
  return url;
}

async function get(raw, { accept, max }) {
  let url = await publicUrl(raw);
  for (let hop = 0; hop < 5; hop++) {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "en-US,en;q=0.9" },
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      url = await publicUrl(new URL(response.headers.get("location"), url).href);
      continue;
    }
    if (!response.ok) throw Object.assign(new Error(`${url.hostname} answered ${response.status}.`), { status: 502 });
    const length = Number(response.headers.get("content-length") || 0);
    if (length > max) throw Object.assign(new Error("That file is too large."), { status: 413 });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > max) throw Object.assign(new Error("That file is too large."), { status: 413 });
    return { url, bytes, type: response.headers.get("content-type") ?? "" };
  }
  throw Object.assign(new Error("Too many redirects."), { status: 502 });
}

export async function fetchImage(raw) {
  const { bytes, type } = await get(raw, { accept: "image/webp,image/png,image/jpeg;q=0.9", max: MAX_IMAGE });
  const sniffed = sniff(bytes);
  if (!sniffed) throw Object.assign(new Error(`That link is not a JPEG, PNG, or WebP image (${type || "unknown type"}).`), { status: 400 });
  return { bytes, type: sniffed };
}

function sniff(b) {
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

function decode(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function meta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag ? decode(tag.match(/content=["']([^"']*)["']/i)?.[1] ?? "") : "";
}

function jsonLdProducts(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const stack = [data];
    while (stack.length) {
      const node = stack.pop();
      if (Array.isArray(node)) stack.push(...node);
      else if (node && typeof node === "object") {
        const type = [].concat(node["@type"] ?? []);
        if (type.includes("Product") || type.includes("ProductGroup")) out.push(node);
        if (node["@graph"]) stack.push(node["@graph"]);
        if (node.hasVariant) stack.push(node.hasVariant);
      }
    }
  }
  return out;
}

function imagesOf(value) {
  return [].concat(value ?? []).flatMap((v) => (typeof v === "string" ? [v] : v?.url ? [v.url] : v?.contentUrl ? [v.contentUrl] : []));
}

function priceOf(products, html) {
  for (const p of products) {
    for (const offer of [].concat(p.offers ?? [])) {
      const low = Number(offer.lowPrice ?? offer.price ?? offer.priceSpecification?.price);
      const high = Number(offer.highPrice);
      if (low > 0) return { priceCents: Math.round(low * 100), priceMaxCents: high > low ? Math.round(high * 100) : null };
    }
  }
  const amount = Number(meta(html, "product:price:amount") || meta(html, "og:price:amount"));
  return amount > 0 ? { priceCents: Math.round(amount * 100), priceMaxCents: null } : { priceCents: null, priceMaxCents: null };
}

const FRACTION = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875 };

function inches(text) {
  const t = text.replace(/[¼½¾⅛⅜⅝⅞]/g, (c) => ` ${FRACTION[c]}`).trim();
  const m = t.match(/^(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+)|\s+(0\.\d+))?/);
  if (!m) return null;
  let n = Number(m[1]);
  if (m[2]) n += Number(m[2]) / Number(m[3]);
  if (m[4]) n += Number(m[4]);
  return Math.round(n * 1000) / 1000;
}

const NUM = String.raw`(\d+(?:\.\d+)?(?:\s+\d+\/\d+|\s*[¼½¾⅛⅜⅝⅞])?)`;
const UNIT = String.raw`\s*(?:"|”|″|''|in\b|inches\b|-inch)`;

function dimensionGuesses(text) {
  const found = { widthIn: [], heightIn: [], depthIn: [] };
  const labels = [
    ["widthIn", /(?:overall\s+)?(?:width|wide|\bW\b)/i],
    ["heightIn", /(?:overall\s+)?(?:height|tall|\bH\b)/i],
    ["depthIn", /(?:overall\s+)?(?:depth|deep|length|\bD\b|\bL\b)/i],
  ];
  for (const [key, label] of labels) {
    const re = new RegExp(`${label.source}[^\\d]{0,24}${NUM}${UNIT}`, "gi");
    for (const m of text.matchAll(re)) {
      const n = inches(m[1]);
      if (n > 0 && n < 400) found[key].push({ value: n, snippet: text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 10).trim() });
    }
  }
  // "89¾"W x 37⅜"D x 32⅝"H" and similar.
  const trio = new RegExp(`${NUM}${UNIT}?\\s*([WDHL])\\s*[x×]\\s*${NUM}${UNIT}?\\s*([WDHL])\\s*[x×]\\s*${NUM}${UNIT}?\\s*([WDHL])`, "gi");
  for (const m of text.matchAll(trio)) {
    const key = { W: "widthIn", D: "depthIn", L: "depthIn", H: "heightIn" };
    for (const [num, letter] of [[m[1], m[2]], [m[3], m[4]], [m[5], m[6]]]) {
      const n = inches(num);
      if (n > 0) found[key[letter.toUpperCase()]].unshift({ value: n, snippet: m[0] });
    }
  }
  const best = {};
  for (const key of Object.keys(found)) best[key] = found[key][0]?.value ?? null;
  const snippets = [...new Set(Object.values(found).flat().map((f) => f.snippet))].slice(0, 8);
  return { ...best, snippets };
}

function candidateImages(html, base, products, name) {
  const urls = [];
  const push = (u) => {
    if (!u || typeof u !== "string") return;
    try {
      const abs = new URL(decode(u), base).href;
      if (!/^https?:/.test(abs) || abs === base) return;
      if (!/\.(jpe?g|png|webp|avif)(\?|$)|\/images?\//i.test(abs)) return;
      if (/sprite|logo|icon|badge|flag|avatar|payment|placeholder|\.svg|\.gif/i.test(abs)) return;
      urls.push(abs);
    } catch {}
  };
  for (const p of products) imagesOf(p.image).forEach(push);
  push(meta(html, "og:image"));
  for (const m of html.matchAll(/https?:\\?\/\\?\/[^"'\s)<>]+?\.(?:jpe?g|png|webp)(?:\?[^"'\s)<>]*)?/gi)) push(m[0].replace(/\\\//g, "/"));
  for (const m of html.matchAll(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/gi)) push(m[1]);

  // IKEA: one id per photo; ask for the large size.
  const seen = new Set();
  const out = [];
  for (const u of urls) {
    let url = u;
    const ikea = url.match(/^(https:\/\/www\.ikea\.com\/[a-z]{2}\/[a-z]{2}\/images\/products\/[a-z0-9-]+__\d+_p[eh]\d+)/);
    if (ikea) url = `${ikea[1]}_s5.jpg`;
    const ikeaId = /ikea\.com\//.test(url) && url.match(/[_/](p[eh]\d+)/i)?.[1].toLowerCase();
    const key = ikeaId || url.replace(/\?.*$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  // Pages also carry photos of other products. When the page's own slug shows
  // up in photo file names, keep just those.
  const slug = new URL(base).pathname.split("/").filter(Boolean).pop()?.toLowerCase().replace(/[-_]?\d+$/, "") ?? "";
  const own = slug.length > 5 ? out.filter((u) => u.toLowerCase().includes(slug)) : [];
  const pool = own.length >= 2 ? own : out;
  // Photos whose file names share words with the product come first.
  const words = (name || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  const score = (u) => words.filter((w) => u.toLowerCase().includes(w)).length;
  return pool
    .map((u, i) => ({ u, i, s: score(u) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.u)
    .slice(0, 40);
}

export async function importListing(raw) {
  const { url, bytes } = await get(raw, { accept: "text/html,application/xhtml+xml", max: MAX_PAGE });
  const html = bytes.toString("utf8");
  const products = jsonLdProducts(html);
  const name = decode(products[0]?.name ?? meta(html, "og:title") ?? html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "").trim();
  const seller = SELLERS.find(([re]) => re.test(url.hostname));
  const brand = products[0]?.brand?.name ?? products[0]?.brand;
  const text = decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
  const dims = dimensionGuesses(text);
  const notes = [];
  if (!products.length) notes.push("The page had no product data, so the name and price may be off.");
  if (/captcha|robot check|access denied/i.test(html.slice(0, 20000))) notes.push(`${url.hostname} may be blocking servers. Paste photo links or upload photos instead.`);
  return {
    details: {
      name,
      sellerName: seller?.[1] ?? (typeof brand === "string" ? brand : "") ?? meta(html, "og:site_name"),
      sellerUrl: seller?.[2] ?? `${url.protocol}//${url.hostname}/`,
      sourceUrl: url.href,
      ...priceOf(products, html),
      widthIn: dims.widthIn,
      heightIn: dims.heightIn,
      depthIn: dims.depthIn,
    },
    dimensionSnippets: dims.snippets,
    candidates: candidateImages(html, url, products, name),
    notes,
  };
}

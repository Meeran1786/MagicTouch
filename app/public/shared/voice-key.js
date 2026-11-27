// MagicTouch voice keys: the one rule that turns a spoken line into a clip file name.
// Shared by the browser (shared/audio-engine.js) and the voice generator
// (scripts/generate-voices.js), so both always agree. Plain ES module, no DOM, no libraries.
//
//   import { normalize, clipId, LANGS } from "/shared/voice-key.js";
//   clipId("Yes! The Apple.", "en-IN")  →  "yes-the-apple-1x0k9q2m3a"
//   file: /assets/voice/en-IN/yes-the-apple-1x0k9q2m3a.mp3

/** The voice languages MagicTouch ships. */
export const LANGS = ["en-IN", "hi-IN", "te-IN"];

/** Maps "English", "hi", "te-IN", "Telugu" … to one of LANGS (default en-IN). */
export function langCode(lang) {
  const l = String(lang || "").toLowerCase();
  if (/^(hi|hindi)/.test(l)) return "hi-IN";
  if (/^(te|telugu)/.test(l)) return "te-IN";
  return "en-IN";
}

/** The language a line is written in, from its script; falls back to the given language. */
export function langOf(text, fallback) {
  if (/[ఀ-౿]/.test(text)) return "te-IN";
  if (/[ऀ-ॿ]/.test(text)) return "hi-IN";
  return langCode(fallback);
}

/** The text that is actually spoken: no HTML tags or entities, single spaces, NFC. */
export function normalize(text) {
  return String(text == null ? "" : text)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFC");
}

// cyrb53: a fast 53-bit string hash (public domain). Same result in Node and every browser.
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** A short hash of the spoken text, so a changed line is noticed. */
export function textHash(text) {
  return cyrb53(normalize(text)).toString(36);
}

/**
 * The clip id of a line: a readable English slug (when there is one) plus a hash of the
 * line. Case does not matter ("Apple" and "apple" share a clip); punctuation does.
 */
export function clipId(text, lang) {
  const t = normalize(text);
  const slug = t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
  const h = cyrb53(langCode(lang) + "|" + t.toLowerCase()).toString(36);
  return slug ? slug + "-" + h : "x-" + h;
}

// The activity JSON fields that templates read aloud (or speak as part of a line).
export const SPEAK_KEYS = new Set([
  "word",
  "text",
  "say",
  "label",
  "explain",
  "intro",
  "instruction",
  "doneText",
  "q",
  "assertion",
  "reason",
  "hintWrong",
  "exploreText",
  "one",
  "many",
]);

/**
 * Every line an activity can speak, from its JSON: [{ text, lang }]. A `code` or `lang` field on
 * an object ("hi-IN", "Telugu") sets the language of the lines inside it; the script of the
 * text (Telugu, Devanagari) wins over that. Lines with {placeholders} are filled in at run
 * time, so they are left out.
 */
export function linesOf(activity) {
  const out = new Map();
  function add(raw, lang) {
    if (typeof raw !== "string" && typeof raw !== "number") return;
    const text = normalize(raw);
    if (!text || text.length > 600 || /[{}]/.test(text) || !/[\p{L}\p{N}]/u.test(text)) return;
    const l = langOf(text, lang);
    out.set(l + "|" + clipId(text, l), { text, lang: l });
  }
  function walk(o, lang) {
    if (Array.isArray(o)) return o.forEach((v) => walk(v, lang));
    if (!o || typeof o !== "object") return;
    const here = /^[a-z]{2}(-[A-Z]{2})?$|^(english|hindi|telugu)$/i.test(o.code || o.lang || "")
      ? langCode(o.code || o.lang)
      : lang;
    for (const [k, v] of Object.entries(o)) {
      if (SPEAK_KEYS.has(k)) {
        if (Array.isArray(v)) v.forEach((x) => (typeof x === "object" ? walk(x, here) : add(x, here)));
        else if (v && typeof v === "object") Object.values(v).forEach((x) => add(x, here));
        else add(v, here);
      }
      if (v && typeof v === "object") walk(v, here);
    }
  }
  walk(activity, "en-IN");
  return [...out.values()];
}

/** A clip id that is safe as a file name (for hand-picked ids in activity JSON). */
export function safeId(id) {
  const s = String(id || "");
  return /^[a-z0-9][a-z0-9_-]{0,80}$/i.test(s) ? s : "";
}

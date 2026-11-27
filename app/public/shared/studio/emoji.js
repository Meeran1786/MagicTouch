// Pictures for emoji: the bundled Twemoji SVGs (CC BY 4.0), so every PC shows the same
// crisp art offline. tools/twemoji.js copies every emoji an activity names into vendor/.
const BASE = "/vendor/twemoji/svg/";

/** "🐘" → "1f418" (the Twemoji file name, without FE0F). */
export function emojiCode(emoji) {
  return Array.from(emoji)
    .map((c) => c.codePointAt(0))
    .filter((c) => c !== 0xfe0f)
    .map((c) => c.toString(16))
    .join("-");
}

export function emojiSrc(emoji) {
  return BASE + emojiCode(emoji) + ".svg";
}

/** An <img> for an emoji; falls back to the system emoji if the picture is missing. */
export function emojiImg(emoji, alt = "") {
  const img = document.createElement("img");
  img.className = "mt-emoji";
  img.src = emojiSrc(emoji);
  img.alt = alt;
  img.draggable = false;
  img.addEventListener(
    "error",
    () => img.replaceWith(Object.assign(document.createElement("span"), { className: "mt-emoji", textContent: emoji })),
    { once: true },
  );
  return img;
}

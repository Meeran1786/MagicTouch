// MagicTouch moving card pictures. Every activity card gets a small animated scene:
// a subject backdrop (floating letters, number paper, paint, hills and sun, music,
// clouds and kite, orbiting atoms) behind the activity's picture, which moves in a
// way that suits the kind of activity (a quiz pops, an explorer sways, 3D turns).
// All of it is our own SVG + CSS animation (crisper and far lighter than GIFs on a
// projector); the pictures are Twemoji (CC BY 4.0, vendored, credited in vendor/LICENSE.md).
// Motion pauses while an activity is open and for "reduce motion" users.
(function () {
  const TWEMOJI = "/vendor/twemoji/svg/";
  const code = e => Array.from(e).map(c => c.codePointAt(0)).filter(c => c !== 0xfe0f).map(c => c.toString(16)).join("-");
  // Some Twemoji files keep the FE0F (keycaps, a few symbols); the build step copies both names.
  const src = e => TWEMOJI + code(e) + ".svg";

  function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; }

  const SCENE = { letters: "letters", numbers: "maths", maths: "maths", colours: "colours", nature: "nature", evs: "nature", play: "play", world: "world", social: "world", science: "science" };
  const MOTION = { Quiz: "pop", Explore: "sway", Languages: "sway", Chart: "tilt", "3D": "turn", Simulate: "wiggle", Play: "bounce",
    Match: "tilt", Sort: "bounce", Order: "tilt", Label: "sway", Predict: "pop", Map: "sway", "Lesson pack": "bob" };
  const BG = { letters: "#FBE4EA", maths: "#EFE0F0", colours: "#FFF1D6", nature: "#E3F4EA", play: "#FFE6A8", world: "#DCEBF7", science: "#EDE3F6" };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pick = (arr, h, i) => arr[(h >>> (i * 3)) % arr.length];

  // Backdrops: viewBox 0 0 200 100, drawn under the picture. Classes animate in launcher.css.
  function backdrop(scene, item, h) {
    const L = (item.title || "ABC").replace(/[^A-Za-z]/g, "").toUpperCase() + "ABCDE";
    switch (scene) {
      case "letters": {
        const tiles = [[18, 70, "#CC3054"], [44, 82, "#F3A328"], [150, 76, "#631654"], [176, 64, "#E96E24"]];
        return tiles.map(([x, y, c], i) => `<g class="fx-rise" style="--i:${i}"><rect x="${x - 9}" y="${y - 9}" width="18" height="18" rx="4" fill="${c}"/><text x="${x}" y="${y + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="#fff" font-family="Georgia,serif">${esc(L[(h + i) % 5] || "A")}</text></g>`).join("");
      }
      case "maths": {
        const glyphs = ["1", "2", "3", "+", "×", "÷", "=", "7", "½", "π"];
        const grid = Array.from({ length: 9 }, (_, i) => `<path d="M${i * 25} 0V100" />`).join("") + Array.from({ length: 4 }, (_, i) => `<path d="M0 ${i * 25 + 12}H200" />`).join("");
        return `<g class="fx-grid">${grid}</g>` + [[22, 80], [48, 30], [160, 84], [182, 36]].map(([x, y], i) =>
          `<text class="fx-rise" style="--i:${i}" x="${x}" y="${y}" text-anchor="middle" font-size="20" font-weight="700" fill="${["#631654", "#CC3054", "#E96E24", "#2fa86a"][i]}" font-family="Georgia,serif">${pick(glyphs, h, i)}</text>`).join("");
      }
      case "colours":
        return `<g class="fx-spin-slow" style="transform-origin:100px 120px"><path d="M10 120a90 90 0 0 1 180 0" fill="none" stroke="#CC3054" stroke-width="8" opacity=".55"/><path d="M22 120a78 78 0 0 1 156 0" fill="none" stroke="#F3A328" stroke-width="8" opacity=".55"/><path d="M34 120a66 66 0 0 1 132 0" fill="none" stroke="#2fa86a" stroke-width="8" opacity=".55"/><path d="M46 120a54 54 0 0 1 108 0" fill="none" stroke="#3b82c4" stroke-width="8" opacity=".55"/></g>`
          + [[24, 30, "#CC3054"], [176, 26, "#3b82c4"], [30, 82, "#F3A328"], [172, 80, "#631654"]].map(([x, y, c], i) => `<circle class="fx-pulse" style="--i:${i}" cx="${x}" cy="${y}" r="9" fill="${c}"/>`).join("");
      case "nature":
        return `<g class="fx-spin" style="transform-origin:172px 22px">${Array.from({ length: 8 }, (_, i) => `<path d="M172 22l0 -17" stroke="#F3A328" stroke-width="3" stroke-linecap="round" transform="rotate(${i * 45} 172 22)"/>`).join("")}</g><circle cx="172" cy="22" r="10" fill="#FBD064"/>`
          + `<path d="M0 86Q40 64 84 82T200 76V100H0z" fill="#9bd7b0"/><path d="M0 94Q60 78 120 92T200 90V100H0z" fill="#2fa86a"/>`
          + [14, 30, 120, 190].map((x, i) => `<path class="fx-sway" style="--i:${i}" d="M${x} 100q-3 -10 2 -18M${x + 4} 100q2 -9 -1 -15" stroke="#1f7a4b" stroke-width="2" fill="none" stroke-linecap="round"/>`).join("")
          + `<g class="fx-fly"><path d="M0 0q-6 -7 -9 -1q3 4 9 1q6 -7 9 -1q-3 4 -9 1z" fill="#CC3054"/></g>`;
      case "play":
        return [[22, 78, "♪", "#631654"], [176, 70, "♫", "#CC3054"], [40, 40, "♩", "#E96E24"], [160, 34, "♬", "#631654"]].map(([x, y, n, c], i) =>
          `<text class="fx-rise" style="--i:${i}" x="${x}" y="${y}" text-anchor="middle" font-size="22" fill="${c}">${n}</text>`).join("")
          + [[70, 14, "#F3A328"], [130, 90, "#2fa86a"], [96, 8, "#CC3054"], [110, 94, "#631654"], [12, 14, "#3b82c4"], [192, 92, "#F3A328"]].map(([x, y, c], i) => `<rect class="fx-twinkle" style="--i:${i}" x="${x}" y="${y}" width="5" height="5" rx="1" fill="${c}" transform="rotate(${i * 25} ${x} ${y})"/>`).join("");
      case "world":
        return `<g class="fx-drift"><path d="M10 30a9 9 0 0 1 16 -5a7 7 0 0 1 12 6h-28z" fill="#fff"/><path d="M120 18a8 8 0 0 1 14 -4a6 6 0 0 1 10 5h-24z" fill="#fff"/></g>`
          + `<g class="fx-drift2"><path d="M150 56a10 10 0 0 1 18 -6a8 8 0 0 1 14 7h-32z" fill="#fff" opacity=".9"/></g>`
          + `<path d="M0 90Q50 76 100 88T200 84V100H0z" fill="#b7d7ec"/>`
          + `<g class="fx-kite" style="transform-origin:34px 70px"><path d="M30 48l8 8-8 8-8-8z" fill="#E96E24"/><path d="M30 64q3 8 -2 14t2 12" stroke="#631654" fill="none" stroke-width="1.2"/></g>`;
      case "science":
        return `<g class="fx-orbit" style="transform-origin:100px 50px"><ellipse cx="100" cy="50" rx="84" ry="26" fill="none" stroke="#63165433" stroke-width="2"/><circle cx="184" cy="50" r="5" fill="#CC3054"/></g>`
          + `<g class="fx-orbit2" style="transform-origin:100px 50px"><ellipse cx="100" cy="50" rx="84" ry="26" fill="none" stroke="#63165422" stroke-width="2" transform="rotate(28 100 50)"/><circle cx="25" cy="10" r="4" fill="#E96E24"/></g>`
          + [[20, 92, 5], [36, 96, 3.5], [172, 94, 4.5], [186, 98, 3]].map(([x, y, r], i) => `<circle class="fx-bubble" style="--i:${i}" cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#631654" stroke-width="1.5" opacity=".6"/>`).join("");
      default: return "";
    }
  }

  // A card picture. `item` is a catalogue entry; returns HTML for the .art box.
  function html(item, opts = {}) {
    const scene = SCENE[item.subject] || "play", h = hash(item.id);
    const motion = MOTION[item.kind] || "bob";
    const delay = -((h % 900) / 100).toFixed(2);
    return `<div class="art mt-scene s-${scene}" style="--bg:${BG[scene]};--d:${delay}s">`
      + `<svg class="fx" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${backdrop(scene, item, h)}</svg>`
      + `<span class="hero m-${motion}">${img(item.icon, opts.alt)}</span></div>`;
  }
  // Just the picture (Twemoji, with the plain emoji as a fallback).
  function img(icon, alt = "") {
    return `<img src="${src(icon)}" alt="${esc(alt)}" draggable="false" onerror="this.replaceWith(document.createTextNode(this.dataset.e))" data-e="${esc(icon)}">`;
  }

  window.MTCardArt = { html, img, src, code };
})();

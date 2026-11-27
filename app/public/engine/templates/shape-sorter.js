// Shape sorter (early years): shape holes in a wooden board above, coloured pieces in the
// tray below. Drag a piece into its hole, or tap the piece and then the hole (hands tap by
// holding still). The right hole takes it with a chime and says its name; a wrong one shakes.
// Fill the board and a new set comes.
// Activity data:
//   shapes: [{ shape: "circle", color: "#E74C3C" }, ...]   circle, square, rectangle, triangle,
//           star, heart, diamond, oval, hexagon, pentagon (see engine/js/early.js)
//   perRound: 5   optional, holes on the board each round
import { MT } from "../js/kit.js";
import { frame, shapeSvg } from "../js/early.js";
import { MTDrag } from "../js/drag.js";

export const meta = { fullscreen: true, music: true, styles: ["early", "shape-sorter"] };

export default function shapeSorter(area, d) {
  const f = frame(area, { icon: d.icon, title: d.title });
  const wrap = document.createElement("div");
  wrap.className = "ss";
  wrap.innerHTML = '<div class="ss-board"></div><div class="ss-tray"></div>';
  f.stage.appendChild(wrap);
  const board = wrap.querySelector(".ss-board");
  const tray = wrap.querySelector(".ss-tray");
  const per = Math.min(d.perRound || 5, d.shapes.length);
  let boards = 0;
  let left = 0;
  let last = "";
  let timer = 0;
  f.score(0);

  function deal() {
    let set;
    do set = MT.shuffle(d.shapes).slice(0, per);
    while (d.shapes.length > per && set.map((s) => s.shape).sort().join() === last);
    last = set.map((s) => s.shape).sort().join();
    left = set.length;
    board.replaceChildren(
      ...MT.shuffle(set).map((s) => {
        const hole = document.createElement("div");
        hole.className = "ss-hole";
        hole.dataset.drop = s.shape;
        hole.innerHTML = shapeSvg(s.shape, "rgba(61, 14, 55, 0.55)");
        return hole;
      }),
    );
    tray.replaceChildren(
      ...MT.shuffle(set).map((s, i) => {
        const piece = document.createElement("button");
        piece.type = "button";
        piece.className = "ss-piece";
        piece.dataset.item = s.shape;
        piece.style.setProperty("--tilt", `${(i % 2 ? 1 : -1) * (4 + Math.random() * 8)}deg`);
        piece.setAttribute("aria-label", s.shape);
        piece.innerHTML = shapeSvg(s.shape, s.color);
        return piece;
      }),
    );
    f.progress(`Board ${boards + 1}`);
  }

  MTDrag(wrap, (piece, hole) => {
    if (hole.classList.contains("filled")) return false;
    if (piece.dataset.item !== hole.dataset.drop) {
      hole.classList.remove("no");
      void hole.offsetWidth;
      hole.classList.add("no");
      MT.sfx.bad();
      return false;
    }
    hole.classList.add("filled");
    hole.replaceChildren(...piece.childNodes);
    piece.remove();
    MT.sfx.good();
    MT.speak(hole.dataset.drop);
    if (--left === 0) {
      boards++;
      f.score(boards);
      timer = setTimeout(() => {
        MT.sfx.win();
        MT.confetti();
        MT.speak("You sorted them all!");
        timer = setTimeout(deal, 2600);
      }, 600);
    }
    return true;
  });

  deal();
  return () => clearTimeout(timer);
}

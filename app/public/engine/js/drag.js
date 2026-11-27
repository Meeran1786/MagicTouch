// Shared "move an item onto a target" behaviour for pen, mouse, touch AND hand mode.
// Two ways to do it: drag the item onto a target, or tap the item then tap the target.
// items:   elements to move (get class mt-card).  targets: elements with data-drop.
// onDrop(itemEl, targetEl) returns true if accepted.
import { MT } from "./kit.js";

export function MTDrag(root, onDrop) {
  let start = null,
    dragging = false,
    ghost = null,
    selected = null,
    hoverEl = null;
  function dropAt(x, y) {
    if (ghost) ghost.style.display = "none";
    const el = document.elementFromPoint(x, y);
    if (ghost) ghost.style.display = "";
    return el && el.closest ? el.closest("[data-drop]") : null;
  }
  function setHover(t) {
    if (hoverEl && hoverEl !== t) hoverEl.classList.remove("hover");
    hoverEl = t;
    if (t) t.classList.add("hover");
  }
  function select(el) {
    if (selected) selected.classList.remove("selected");
    selected = el;
    if (el) {
      el.classList.add("selected");
      MT.sfx.tap();
    }
  }
  function down(e) {
    const it = e.target.closest && e.target.closest("[data-item]");
    if (!it || !root.contains(it) || it.classList.contains("placed")) return;
    start = { el: it, x: e.clientX, y: e.clientY };
    dragging = false;
  }
  function move(e) {
    if (!start) return;
    if (!dragging && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 14) {
      dragging = true;
      select(null);
      ghost = start.el.cloneNode(true);
      ghost.classList.add("mt-ghost");
      const r = start.el.getBoundingClientRect();
      ghost.style.width = r.width + "px";
      ghost.style.height = r.height + "px";
      document.body.appendChild(ghost);
      start.el.style.opacity = 0.35;
    }
    if (dragging) {
      ghost.style.left = e.clientX + "px";
      ghost.style.top = e.clientY + "px";
      setHover(dropAt(e.clientX, e.clientY));
    }
  }
  function up(e) {
    if (start && dragging) {
      const t = dropAt(e.clientX, e.clientY);
      start.el.style.opacity = "";
      if (ghost) ghost.remove();
      ghost = null;
      setHover(null);
      if (t) onDrop(start.el, t);
      start = null;
      dragging = false;
      return;
    }
    if (start) {
      // a tap on an item: select it (tap again to unselect)
      select(selected === start.el ? null : start.el);
      start = null;
      return;
    }
    // a tap somewhere else: if an item is selected and this is a target, drop it there
    const t2 = e.target.closest ? e.target.closest("[data-drop]") : null;
    if (selected && t2 && root.contains(t2)) {
      const s = selected;
      select(null);
      onDrop(s, t2);
    }
  }
  document.addEventListener("pointerdown", down);
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", up);
  return {
    destroy: function () {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      if (ghost) ghost.remove();
    },
    select: select,
  };
}

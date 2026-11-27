// MagicTouch shared kit: speech, sounds, feedback, confetti, score. Every template imports it.
import { audioCtx as sharedAudio } from "/shared/studio/soft-music.js";
// Motion, sound, low-spec and confetti come from the shared motion engine (the Gold Standard layer).
import { ME } from "/shared/motion-engine.js";

export const audioCtx = sharedAudio();
export const MT = (function () {
  let voice = null;
  function pickVoice() {
    const v = speechSynthesis.getVoices();
    voice =
      v.find(function (x) {
        return x.lang === "en-IN";
      }) ||
      v.find(function (x) {
        return /^en/.test(x.lang) && /female|samantha|zira|veena|heera/i.test(x.name);
      }) ||
      v.find(function (x) {
        return /^en/.test(x.lang);
      }) ||
      null;
  }
  if (window.speechSynthesis) {
    speechSynthesis.onvoiceschanged = pickVoice;
    pickVoice();
  }
  // speak(text) in Indian English; speak(text, "hi-IN") or "te-IN" for Hindi and Telugu
  function speak(t, lang) {
    if (!window.speechSynthesis || !t) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    if (lang) {
      u.lang = lang;
      const v = speechSynthesis.getVoices().find(function (x) {
        return x.lang === lang;
      });
      if (v) u.voice = v;
    } else if (voice) u.voice = voice;
    u.rate = 0.9;
    u.pitch = 1.05;
    speechSynthesis.speak(u);
  }
  // sounds, the sound switch, loops and device checks: see /shared/motion-engine.js
  const sfx = ME.sound;
  const soundOn = ME.sound.on;
  const setSound = ME.sound.set;
  const loop = ME.loop;
  const lowSpec = ME.lowSpec;
  const calm = ME.calm;
  let toastT = null;
  function toast(msg, kind) {
    const el = document.getElementById("mt-toast");
    el.textContent = msg;
    el.className = "show " + (kind || "");
    clearTimeout(toastT);
    toastT = setTimeout(function () {
      el.className = "";
    }, 1600);
  }
  // Design system: at most 60 confetti pieces, fewer on low-spec PCs, none with reduced motion.
  function confetti() {
    const c = ["#631654", "#CC3054", "#E96E24", "#F3A328", "#FBD064", "#2FA86A"];
    if (calm()) return;
    const n = lowSpec() ? 20 : 60;
    for (let i = 0; i < n; i++) {
      const e = document.createElement("div");
      e.className = "mt-confetti";
      e.style.cssText =
        "left:" +
        Math.random() * 100 +
        "vw;top:-20px;background:" +
        c[i % c.length] +
        ";animation-duration:" +
        (1.2 + Math.random() * 1.4) +
        "s;animation-delay:" +
        Math.random() * 0.4 +
        "s;";
      document.body.appendChild(e);
      setTimeout(
        (function (x) {
          return function () {
            x.remove();
          };
        })(e),
        3200,
      );
    }
  }
  // A short canvas confetti burst from the middle of `el` (1.2 s): at most 60 pieces, 24 on
  // low-spec PCs, none with reduced motion. One overlay canvas, removed when the burst ends.
  const burst = ME.burst;
  function score(t) {
    document.getElementById("mt-score").textContent = t || "";
  }
  function good(msg, say) {
    sfx.good();
    toast(msg || "Well done!", "good");
    if (say) speak(say);
  }
  function bad(msg, say) {
    sfx.bad();
    toast(msg || "Try again", "bad");
    if (say) speak(say);
  }
  // finish screen. extra: optional HTML under the message (e.g. a quiz review).
  // Inside a lesson pack, MT.next is set by the pack and adds a "Next step" button.
  function done(area, msg, onAgain, extra) {
    sfx.win();
    confetti();
    speak(msg);
    const d = document.createElement("div");
    d.className = "mt-done";
    d.innerHTML = "<div>" + msg + "</div>" + (extra ? '<div class="mt-done-x">' + extra + "</div>" : "");
    const row = document.createElement("div");
    row.className = "mt-done-b";
    d.appendChild(row);
    const b = document.createElement("button");
    b.className = "mt-btn" + (api.next ? " alt" : "");
    b.textContent = api.next ? "Do it again" : "Play again";
    b.addEventListener("click", onAgain);
    row.appendChild(b);
    if (api.next) {
      const n = document.createElement("button");
      n.className = "mt-btn";
      n.textContent = api.nextLabel || "Next step →";
      const go = api.next;
      n.addEventListener("click", function () {
        go();
      });
      row.appendChild(n);
    }
    area.appendChild(d);
  }
  // timers that belong to the current activity; cleared when another activity or the menu opens
  let timers = [];
  function later(fn, ms) {
    const t = setTimeout(fn, ms);
    timers.push(t);
    return t;
  }
  function clearLater() {
    timers.forEach(clearTimeout);
    timers = [];
  }
  // a picture box that keeps the SVG's shape, so % positions on it line up with the drawing
  function sceneBox(holder, svgText) {
    holder.style.display = "flex";
    holder.style.alignItems = "center";
    holder.style.justifyContent = "center";
    holder.style.minHeight = "0";
    holder.style.minWidth = "0";
    const box = document.createElement("div");
    box.style.position = "relative";
    box.innerHTML = svgText;
    holder.appendChild(box);
    const svg = box.querySelector("svg");
    let W = 400;
    let H = 400;
    if (svg) {
      const vb = (svg.getAttribute("viewBox") || "").split(/[ ,]+/).map(Number);
      if (vb.length === 4 && vb[2] > 0) {
        W = vb[2];
        H = vb[3];
      }
      svg.style.cssText += ";position:absolute;left:0;top:0;width:100%;height:100%;display:block;";
    }
    function fit() {
      const w = holder.clientWidth,
        h = holder.clientHeight;
      if (!w || !h) return;
      const k = Math.min(w / W, h / H);
      box.style.width = W * k + "px";
      box.style.height = H * k + "px";
    }
    fit();
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(fit);
      ro.observe(holder);
    } else window.addEventListener("resize", fit);
    requestAnimationFrame(fit);
    return box;
  }
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }
  // an item's face: {icon:"🐦", text:"Bird"} or {fraction:[1,2]} or {svg:"<svg…>"}
  function face(it) {
    if (it.fraction)
      return (
        fractionSVG(it.fraction[0], it.fraction[1]) +
        '<div class="txt">' +
        it.fraction[0] +
        "/" +
        it.fraction[1] +
        "</div>"
      );
    if (it.dots) return dotsSVG(it.dots) + (it.text ? '<div class="txt">' + it.text + "</div>" : "");
    return (
      (it.svg || "") +
      (it.icon ? '<div class="ico">' + it.icon + "</div>" : "") +
      (it.text ? '<div class="txt">' + it.text + "</div>" : "")
    );
  }
  function fractionSVG(n, d) {
    let s = '<svg viewBox="-55 -55 110 110" width="96" height="96">';
    for (let i = 0; i < d; i++) {
      const a0 = (i / d) * 2 * Math.PI - Math.PI / 2,
        a1 = ((i + 1) / d) * 2 * Math.PI - Math.PI / 2;
      s +=
        '<path d="M0 0 L' +
        50 * Math.cos(a0) +
        " " +
        50 * Math.sin(a0) +
        " A50 50 0 0 1 " +
        50 * Math.cos(a1) +
        " " +
        50 * Math.sin(a1) +
        'Z" fill="' +
        (i < n ? "#E96E24" : "#FFF0D8") +
        '" stroke="#3D0E37" stroke-width="2.5"/>';
    }
    return s + "</svg>";
  }
  function dotsSVG(n) {
    const cols = 5;
    const rows = Math.ceil(n / cols);
    let s =
      '<svg viewBox="0 0 ' + cols * 22 + " " + rows * 22 + '" width="' + cols * 20 + '" height="' + rows * 20 + '">';
    for (let i = 0; i < n; i++)
      s +=
        '<circle cx="' +
        (11 + (i % cols) * 22) +
        '" cy="' +
        (11 + Math.floor(i / cols) * 22) +
        '" r="8" fill="' +
        (i < 10 ? "#CC3054" : "#E96E24") +
        '"/>';
    return s + "</svg>";
  }
  const api = {
    lowSpec: lowSpec,
    calm: calm,
    loop: loop,
    soundOn: soundOn,
    setSound: setSound,
    later: later,
    clearLater: clearLater,
    sceneBox: sceneBox,
    speak: speak,
    sfx: sfx,
    toast: toast,
    confetti: confetti,
    burst: burst,
    score: score,
    good: good,
    bad: bad,
    done: done,
    shuffle: shuffle,
    face: face,
    templates: {},
    next: null,
    nextLabel: null,
  };
  return api;
})();

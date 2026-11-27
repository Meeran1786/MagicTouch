// MagicTouch engine: runs every activity on the wall.
//
// An activity is data: /activities/<id>/activity.json names its template and holds its
// content. A template is code: /engine/templates/<name>.js, default export
// mount(area, activity, ctx) that draws into `area` and returns a cleanup function.
//
//   /engine/?a=<id>          runs one activity (the wall opens activities like this)
//   /engine/                 a simple menu of every activity, for a PC without the wall
//   /engine/?demo            the menu, approved activities only
//   &wall=1                  inside the wall launcher: no header, Back goes to the wall menu
//
// A template's meta: { fullscreen, styles: [css names], points: pens/hands it follows, music }
import { MT, audioCtx } from "./kit.js";
import { MagicAudio } from "/shared/audio-engine.js";
import { LEVELS, levelLabel } from "/shared/levels.js";
import { startInput } from "/shared/input/pointer.js";
import { startMusic, stopMusic } from "/shared/studio/music.js";

const $ = (id) => document.getElementById(id);
const menu = $("mt-menu");
const stage = $("mt-stage");
const area = $("mt-area");
const instr = $("mt-instr");
const crumb = $("mt-crumb");
const back = $("mt-back");

const query = new URLSearchParams(location.search);
const ONLY = query.get("a");
const WALL = query.get("wall") === "1";
const DEMO = query.has("demo");
const SUBJECTS = { maths: "Maths", science: "Science", social: "Social", evs: "EVS" };
const NAME = /^[a-z0-9][a-z0-9-]*$/;

let index = [];
let cleanup = null;
const cache = new Map();

/** Loads a template module by name (cached). Resolves to its mount function. */
export async function loadTemplate(name) {
  if (!NAME.test(name || "")) throw new Error("bad template name: " + name);
  const mod = await import(`../templates/${name}.js`);
  const styles = (mod.meta && mod.meta.styles) || [];
  await Promise.all(styles.map(addStyle));
  return Object.assign(mod.default, { meta: mod.meta || {} });
}

/** Links /engine/templates/<name>.css once and waits for it. */
function addStyle(name) {
  if (!NAME.test(name) || document.querySelector(`link[data-style="${name}"]`)) return Promise.resolve();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL(`../templates/${name}.css`, import.meta.url).href;
  link.dataset.style = name;
  const loaded = new Promise((resolve) => {
    link.onload = link.onerror = resolve;
  });
  document.head.appendChild(link);
  return loaded;
}

/** Loads one activity file (cached). */
export async function loadActivity(id) {
  if (!NAME.test(id || "")) throw new Error("bad activity id: " + id);
  if (!cache.has(id)) {
    cache.set(
      id,
      fetch(`/activities/${id}/activity.json`).then((r) => {
        if (!r.ok) throw new Error(`activity "${id}" not found`);
        return r.json();
      }),
    );
  }
  return cache.get(id);
}

let ambience = null; // the activity's quiet theme loop ("ambience": "rain"), if it has one

function stop() {
  MT.clearLater();
  stopMusic();
  if (ambience) ambience.stop(0.6);
  ambience = null;
  delete document.documentElement.dataset.music;
  if (cleanup) {
    try {
      cleanup();
    } catch (e) {
      console.warn("[engine] cleanup failed", e);
    }
  }
  cleanup = null;
  MT.stopSpeech();
  area.innerHTML = "";
  MT.score("");
}

function showMenu() {
  stop();
  document.documentElement.classList.remove("mt-full");
  stage.classList.add("hidden");
  menu.classList.remove("hidden");
  back.classList.add("hidden");
  crumb.textContent = "";
}

async function run(id) {
  stop();
  let activity, mount;
  try {
    activity = await loadActivity(id);
    mount = await loadTemplate(activity.template);
  } catch (e) {
    menu.classList.remove("hidden");
    menu.innerHTML = "";
    note(`This activity cannot open: ${e.message}`);
    return;
  }
  const others = await Promise.all(
    (activity.steps || []).filter((s) => s.ref).map((s) => loadActivity(s.ref).catch(() => null)),
  );
  const byId = Object.fromEntries(others.filter(Boolean).map((a) => [a.id, a]));
  menu.classList.add("hidden");
  stage.classList.remove("hidden");
  back.classList.remove("hidden");
  document.documentElement.classList.toggle("mt-full", !!mount.meta.fullscreen);
  document.title = activity.title + " · MagicTouch";
  crumb.textContent = `— ${levelLabel(activity.level)} · ${activity.title}`;
  instr.textContent = activity.instruction || "";
  await startInput({ maxPoints: mount.meta.points || 1 });
  const ctx = {
    base: `/activities/${id}/`,
    again: () => run(id),
    home: goHome,
    activity: (ref) => byId[ref] || null,
    loadTemplate,
  };
  // early-years templates ask for the soft background music (meta.music); the frame shows its toggle
  if (mount.meta.music) {
    document.documentElement.dataset.music = "1";
    startMusic();
  }
  cleanup = mount(area, activity, ctx) || null;
  MagicAudio.preloadActivity(activity);
  // theme sounds (CLAUDE.md §8): "sfx" plays once as the activity opens, "ambience" loops quietly
  // under it; with no file in /assets/sfx/themes/ yet they play nothing
  if (activity.sfx) MT.theme(activity.sfx);
  if (activity.ambience) ambience = MT.theme(activity.ambience, { loop: true });
  if (activity.intro) MT.speak(activity.intro);
}

function goHome() {
  if (WALL && window.parent !== window) {
    window.parent.postMessage({ type: "mt-home" }, location.origin);
    return;
  }
  if (ONLY) {
    location.href = "./";
    return;
  }
  showMenu();
}

function note(text) {
  const d = document.createElement("div");
  d.className = "mt-demo-note";
  d.textContent = text;
  menu.appendChild(d);
}

function buildMenu() {
  menu.innerHTML = "";
  const list = DEMO ? index.filter((a) => a.status === "approved") : index;
  if (DEMO && !list.length) {
    note(
      'Demo mode shows approved activities only, and none are approved yet. Set "status": "approved" in an activity file, or open the page without ?demo.',
    );
    return;
  }
  for (const level of LEVELS) {
    const here = list.filter((a) => a.level === level.key);
    if (!here.length) continue;
    const h = document.createElement("div");
    h.className = "mt-sec";
    h.textContent = level.label;
    menu.appendChild(h);
    for (const a of here) {
      const t = document.createElement("a");
      t.className = "mt-tile" + (a.showcase ? " mt-show" : "");
      t.href = `?a=${encodeURIComponent(a.id)}`;
      const subject = SUBJECTS[a.subject] || a.subject || "";
      t.innerHTML =
        `<span class="cls subj-${a.subject}"></span><div class="ttl"></div><div class="sub"></div>` +
        (a.status === "approved" ? "" : '<span class="mt-draft">Draft</span>');
      t.querySelector(".cls").textContent = `${level.label}${subject ? " · " + subject : ""}`;
      t.querySelector(".ttl").textContent = `${a.icon || ""} ${a.title}`.trim();
      t.querySelector(".sub").textContent = a.topic || "";
      t.addEventListener("click", () => {
        try {
          audioCtx.resume();
        } catch {
          /* no audio */
        }
      });
      menu.appendChild(t);
    }
  }
}

if (WALL) document.documentElement.classList.add("mt-wall");
back.addEventListener("click", goHome);

if (ONLY) {
  run(ONLY);
} else {
  fetch("/activities/index.json")
    .then((r) => r.json())
    .then((list) => {
      index = list;
      buildMenu();
      showMenu();
      startInput();
    })
    .catch((e) => note("Could not load the activity list: " + e.message));
}

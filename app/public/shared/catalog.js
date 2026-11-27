// MagicTouch catalogue: one list of everything the wall can open, read from the activity
// index (activities/index.json, written by tools/activities.js). Every item:
//   { id, level, subject, title, subtitle, icon, kind, path, draft, showcase }
// level is a licence key (shared/levels.js); path opens the activity in the engine.
import { LEVELS } from "./levels.js";

const SUBJECTS = {
  letters: ["Letters and words", "abc"],
  numbers: ["Numbers and shapes", "num"],
  colours: ["Colours", "palette"],
  nature: ["Nature and animals", "leaf"],
  play: ["Music and play", "music"],
  world: ["Me and my world", "home"],
  maths: ["Maths", "num"],
  science: ["Science", "atom"],
  social: ["Social", "globe"],
  evs: ["EVS", "leaf"],
};
export const EARLY_SUBJECTS = ["letters", "numbers", "colours", "nature", "play", "world"];

// What a card says the activity is, by template.
const KIND = {
  explore: "Explore",
  match: "Match",
  sort: "Sort",
  order: "Order",
  label: "Label",
  simulate: "Simulate",
  space3d: "3D",
  reveal: "Predict",
  ball: "Play",
  quiz: "Quiz",
  map: "Map",
  pack: "Lesson pack",
  "emoji-quiz": "Quiz",
  "picture-quiz": "Quiz",
  "picture-spotter": "Quiz",
  "balloon-pop": "Quiz",
  "picture-chart": "Chart",
  "word-wheel": "Languages",
  "picture-reveal": "Explore",
  "sound-poster": "Explore",
  "animal-3d": "3D",
  trace: "Trace",
  piano: "Music",
  conductor: "Music",
  "pop-storm": "Play",
  slice: "Play",
  "catch-stars": "Play",
  "count-pick": "Play",
  "shadow-puppet": "Play",
  "shape-sorter": "Play",
};
const SUBJECT_EMOJI = { maths: "➗", science: "🔬", social: "🌏", evs: "🌱" };

/** Every picture the catalogue itself can show (tools/twemoji.js copies these into vendor/). */
export const ICONS = [...Object.values(SUBJECT_EMOJI), "✨"];

/** Loads the catalogue. Old usage records name engine activities "engine:<id>"; byId accepts both. */
export async function loadCatalog() {
  const list = await (await fetch("/activities/index.json", { cache: "no-cache" })).json();
  const items = list.map((a) => ({
    id: a.id,
    level: a.level,
    subject: a.subject,
    title: a.title,
    subtitle: a.topic || "",
    icon: a.icon || SUBJECT_EMOJI[a.subject] || "✨",
    kind: KIND[a.template] || "Activity",
    path: `/engine/?a=${encodeURIComponent(a.id)}&wall=1`,
    draft: a.status !== "approved",
    showcase: !!a.showcase,
    early: EARLY_SUBJECTS.includes(a.subject),
  }));
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  return {
    levels: LEVELS,
    items,
    byId: new Proxy(byId, {
      get: (t, id) => (typeof id === "string" ? t[id] || t[id.replace(/^engine:/, "")] : undefined),
    }),
    subjectLabel: (s) => (SUBJECTS[s] || [s])[0],
    subjectIcon: (s) => (SUBJECTS[s] || [s, "star"])[1],
  };
}

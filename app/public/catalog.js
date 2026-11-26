// MagicTouch catalogue: one list of everything the wall can open.
//   • Early years activities from apps.js (purchased Interactive Wall code)
//   • Classes 1–10 and Intermediate activities from our JSON engine (/engine/poc/activities)
// Every entry: { id, level, subject, title, subtitle, icon, kind, path, draft }
// level is a licence key: nursery, prekg, lkg, class-1 … class-10, inter-1, inter-2.
(function () {
  const LEVELS = [
    { key: "nursery", label: "Nursery", group: "early", art: "sun" },
    { key: "prekg", label: "Pre-KG", group: "early", art: "abc" },
    { key: "lkg", label: "LKG", group: "early", art: "kite" },
    ...Array.from({ length: 10 }, (_, i) => ({ key: `class-${i + 1}`, label: `Class ${i + 1}`, short: String(i + 1), group: "classes" })),
    { key: "inter-1", label: "Inter 1st year", group: "inter", art: "atom" },
    { key: "inter-2", label: "Inter 2nd year", group: "inter", art: "flask" },
  ];
  const CATEGORY_TO_LEVEL = { "Nursery": "nursery", "Pre-KG": "prekg", "LKG": "lkg", "Live Animals": "prekg" };

  // Early-years subjects, so a class screen has a subject rail like the higher classes.
  const EARLY_SUBJECTS = [
    ["letters", "Letters and words", /alphabet|jungle(safari|quiz)|rhyme|position|opposite|lang\d|tracing|communication/],
    ["numbers", "Numbers and shapes", /number|counting|shape|clock|money/],
    ["colours", "Colours", /colou?r/],
    ["nature", "Nature and animals", /animal|garden|fruit|bird|flower|bug|sea|zoo|farm|nuts|spice|harvest|plant|living|landform|season|weather|winter|summer|wild|space|camping/],
    ["play", "Music and play", /music|piano|slash|bubble|conductor|dodge|puppet|yoga|sport|play|games|circus|fantasy/],
    ["world", "Me and my world", /./],
  ];
  const SUBJECT_LABEL = { maths: "Maths", science: "Science", social: "Social", evs: "EVS" };
  const SUBJECT_ICON = { letters: "abc", numbers: "num", colours: "palette", nature: "leaf", play: "music", world: "home", maths: "num", science: "atom", social: "globe", evs: "leaf" };

  function earlySubject(id) { return EARLY_SUBJECTS.find(([, , re]) => re.test(id))[0]; }

  function kindOf(app) {
    const p = app.id;
    if (/chart$/.test(p)) return "Chart";
    if (/quiz|spotter|find|pop/.test(p)) return "Quiz";
    if (/lang/.test(p)) return "Languages";
    if (/safari|alphabets|animals$/.test(p)) return "Explore";
    return "Play";
  }

  function fromWall(apps) {
    return apps.map(a => ({
      id: a.id,
      level: CATEGORY_TO_LEVEL[a.category] || "prekg",
      subject: earlySubject(a.id),
      title: a.title, subtitle: a.subtitle, icon: a.icon,
      kind: kindOf(a), path: a.path, draft: false, source: "wall",
    }));
  }

  function levelForGrade(g) { return g <= 10 ? `class-${g}` : g === 11 ? "inter-1" : "inter-2"; }
  const TEMPLATE_KIND = { explore: "Explore", match: "Match", sort: "Sort", order: "Order", label: "Label", simulate: "Simulate",
    space3d: "3D", reveal: "Predict", ball: "Play", quiz: "Quiz", map: "Map", pack: "Lesson pack" };
  const SUBJECT_EMOJI = { maths: "➗", science: "🔬", social: "🌏", evs: "🌱" };

  function fromEngine(acts) {
    return acts.filter(a => a.grade >= 1).map(a => ({
      id: "engine:" + a.id,
      level: levelForGrade(a.grade),
      subject: a.subject,
      title: a.title, subtitle: a.topic || "",
      icon: SUBJECT_EMOJI[a.subject] || "✨",
      kind: TEMPLATE_KIND[a.template] || "Activity",
      path: `/engine/poc/?a=${encodeURIComponent(a.id)}&wall=1`,
      draft: a.status !== "approved", source: "engine",
    }));
  }

  async function loadEngine() {
    try {
      const list = await (await fetch("/engine/poc/activities/index.json", { cache: "no-cache" })).json();
      return await Promise.all(list.map(f => fetch("/engine/poc/activities/" + f, { cache: "no-cache" }).then(r => r.json())));
    } catch (e) { console.warn("[catalog] engine activities not loaded:", e); return []; }
  }

  async function load() {
    const items = fromWall(window.WALL_APPS || []).concat(fromEngine(await loadEngine()));
    const byId = Object.fromEntries(items.map(i => [i.id, i]));
    return { levels: LEVELS, items, byId, subjectLabel: s => SUBJECT_LABEL[s] || (EARLY_SUBJECTS.find(x => x[0] === s) || [, s])[1], subjectIcon: s => SUBJECT_ICON[s] || "star" };
  }

  window.MTCatalog = { load, LEVELS };
})();

// Class levels, in menu order. A level key is also a licence key (data/licence.json).
export const LEVELS = [
  { key: "nursery", label: "Nursery", group: "early", art: "sun" },
  { key: "prekg", label: "Pre-KG", group: "early", art: "abc" },
  { key: "lkg", label: "LKG", group: "early", art: "kite" },
  ...Array.from({ length: 10 }, (_, i) => ({
    key: `class-${i + 1}`,
    label: `Class ${i + 1}`,
    short: String(i + 1),
    group: "classes",
  })),
  { key: "inter-1", label: "Inter 1st year", group: "inter", art: "atom" },
  { key: "inter-2", label: "Inter 2nd year", group: "inter", art: "flask" },
];

export const LEVEL_KEYS = LEVELS.map((l) => l.key);

/** "class-4" → "Class 4" */
export function levelLabel(key) {
  const level = LEVELS.find((l) => l.key === key);
  return level ? level.label : key || "";
}

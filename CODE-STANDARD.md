# MagicTouch code standard

One way to write everything in MagicTouch: chapters, activities, games and simulations,
whether we wrote them or they came with the purchased code. The visual and motion rules are in
[CLAUDE.md](CLAUDE.md) (the design system); this file covers how the code is built.

Run `npm run check` in `app/` before every commit. It runs everything below that a machine can check.

## 1. The stack

| Part | What we use | Not allowed |
|---|---|---|
| Pages and activities | Plain HTML, CSS and JavaScript (ES2023 modules) in Chrome or Edge | Frameworks (React, Vue, Tailwind, jQuery), p5.js, ml5.js, build steps |
| Drawing and motion | Canvas 2D, layered SVG, CSS transforms and opacity | Animating `top`, `left`, `width` or `height`; GIF-only motion where code can do it |
| 3D | three.js r170 from `public/vendor/three` (import map name `three`) | Any other three.js copy |
| Camera input | `public/shared/input/` only (IR pen and MediaPipe hand) | Per-activity trackers or calibration |
| Sound | Web Audio through `shared/studio/soft-music.js` and `engine/js/kit.js` | Audio libraries |
| Server | `app/server/`, Node 18+ built-ins only, file store `data/store.json` | npm packages at run time, online databases |
| Network | Nothing loads from the internet; every library and font is in `public/vendor` | CDNs, web fonts, remote media |

## 2. Where things live (`app/`)

```
server/                 offline Node server: API, logins, licence, file store
public/
  index.html            the wall launcher and phone remote (launcher.js, teams.js)
  school/               School view
  calibrate/            the 9-dot calibration page
  engine/               runs every activity: /engine/?a=<id>
    js/                 engine.js, kit.js (MT helpers), early.js, arcade.js, drag.js, expr.js, sim-real.js
    templates/          one ES module per template, plus its CSS
    data/               shared data (concepts.json)
  activities/<id>/      activity.json and that activity's own media
  activities/index.json written by tools/activities.js; never edit by hand
  shared/               levels.js, catalog.js, input/, studio/ (tokens, emoji, music, card art)
  vendor/               third-party libraries, unchanged (see vendor/LICENSE.md)
tools/                  checkers and one-off builders (activities, offline, asset audit, twemoji)
tests/                  node:test unit tests; tests/browser/ Playwright checks
```

## 3. Activities are data, templates are code

An activity is a folder `public/activities/<id>/` with an `activity.json` and its media. It holds
content only, never code.

```json
{
  "id": "fruitquiz1",
  "level": "prekg",
  "subject": "nature",
  "title": "Fruit & Veggie Quiz 1",
  "topic": "Name the fruit and vegetables",
  "icon": "🍎",
  "status": "approved",
  "template": "picture-quiz",
  "items": [{ "word": "Apple", "photo": "assets/photos/apple.jpg" }]
}
```

- `id` matches the folder: lowercase letters, digits and hyphens.
- `level` is a key from `shared/levels.js` (nursery, prekg, lkg, class-1 … class-10, inter-1, inter-2).
- `subject` is maths, science, social or evs for classes; letters, numbers, colours, nature, play or
  world for the early years. Class activities also need `concept` and `instruction`.
- `status` is `draft` until the content is reviewed, then `approved`.
- Media paths are relative to the activity folder. Optional `media: { "type": "mp4" | "lottie" | "rive", "src": "..." }`
  slots upgrade a template's code-drawn visual; the template must work without them.
- After adding or changing an activity, run `node tools/activities.js`. It checks every field the
  template needs and every file the activity names, and rewrites the index.

A template is `public/engine/templates/<name>.js`:

```js
// Picture quiz (early years): what it does, in a sentence or two.
// Activity data:
//   items: [{ word, photo | emoji | swatch | shape }]   what each field means
import { MT } from "../js/kit.js";
import { frame } from "../js/early.js";

export const meta = { fullscreen: true, styles: ["early", "picture-quiz"], points: 1, music: true };

export default function pictureQuiz(area, activity, ctx) {
  // draw into `area`; ctx = { base, again, home, activity(ref), loadTemplate }
  return () => {
    /* stop timers, loops, listeners */
  };
}
```

- The comment at the top says what the template does and documents every activity field it reads.
- `meta.fullscreen` hides the engine's header; `styles` lists CSS files in `templates/`;
  `points` is how many pens or hands it follows at once; `music` turns on the early-years background music.
- The cleanup function stops everything the template started. The engine calls it when the
  activity closes.
- New behaviour goes into an existing template with a new data field where it fits. Make a new
  template only when no existing one can express the activity, and add its required fields to
  `NEEDS` in `tools/activities.js`.

Shared building blocks: `early.js` (frame, result card, pictures, spelling), `arcade.js` (canvas
games: sizing, frame loop, every pointer, particles), `drag.js` (drag or tap-tap onto targets),
`kit.js` (`MT.speak`, `MT.sfx`, `MT.confetti`, `MT.shuffle`, `MT.lowSpec()`, `MT.calm()`),
`sim-real.js` (realistic simulation scenes), `expr.js` (safe formulas for simulations).

## 4. Input

Templates never read the camera. `shared/input/pointer.js` turns the IR pen and the hand into
ordinary `pointerdown`, `pointermove`, `pointerup` and `click` events, so a template written for the
mouse works on the wall. Games that follow several pens or both hands also call `onPoints(fn)`.

- Use `click` for taps and pointer events for drags. Hands cannot press and drag, so every drag
  must also work as tap-then-tap (`drag.js` does this).
- Targets are at least `--mt-target` (96 px) and well spaced; never shrink them.
- Do not use hover alone for anything important, except in free-play games where pointing is the play.

## 5. Look and sound

- Colours, type, radii and the spring curve come from `shared/studio/tokens.css` (`--mt-plum`,
  `--mt-target`, `--mt-spring` and so on). Do not write new hex colours in CSS when a token exists.
- English uses Cambria/Caladea for headings and Calibri/Carlito for text; Telugu and Hindi use
  the bundled Noto fonts.
- Emoji pictures are the bundled Twemoji SVGs (`shared/studio/emoji.js`, or `arcade.js` on canvas).
  Run `node tools/twemoji.js <package dir>` after adding new emoji.
- Respect `prefers-reduced-motion` (`MT.calm()`) and `window.MAGICTOUCH_LOW_SPEC` (`MT.lowSpec()`):
  at most 60 confetti pieces and 40 particles, fewer on low-spec PCs.
- Pause animation loops, videos and players while the page is hidden.
- Sounds go through `MT.sfx` (they follow the school's sound setting) or the shared `audioCtx`.

## 6. Writing code

- Formatting is Prettier (`.prettierrc.json`, 120 columns); `npm run format` fixes it. `.editorconfig`
  sets UTF-8, LF and two spaces.
- Linting is ESLint (`eslint.config.js`); `npm run lint` must pass with no errors.
- ES modules everywhere in `public/` and `server/`; `const` by default, `let` when it changes, never `var`.
- Names: files and template names in kebab-case (`picture-quiz.js`), functions and variables in
  camelCase, constants in UPPER_CASE, CSS classes with a short template prefix (`.pq-`, `.ey-`).
- Comments say why, in plain English, for a teacher-facing product: no ticket numbers, no
  author names.
- No globals on `window` except the documented flags (`MAGICTOUCH_LOW_SPEC`, and
  `MAGICTOUCH_FAKE_TRACKER` for tests).

## 7. Data and privacy

- No personal data about children is stored anywhere: no names, photos or scores per child. Usage
  is counted per wall login.
- All content is our own or properly licensed. Media from the purchased code is listed in
  `app/ASSETS-AUDIT.csv` (`node tools/asset-audit.js`); new third-party media needs its source and
  licence recorded in the content credits log before it ships.

## 8. Checks and tests

| Command (in `app/`) | What it checks |
|---|---|
| `npm run lint` | ESLint |
| `npm run format:check` | Prettier |
| `npm test` | Server API, homography maths, template contract, and every activity file |
| `node tools/offline.js` | Nothing loads from the internet |
| `node tools/asset-audit.js --check` | No stock-library watermarks in media |
| `node tools/twemoji.js --check` | Every emoji picture is bundled |
| `npm run check` | All of the above |
| `npm run test:browser` | Opens and touches every activity in Chromium (server on port 8090) |
| `node tests/browser/input.cjs` | Pen and hand input end to end with a stand-in camera |

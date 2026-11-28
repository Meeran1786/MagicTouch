# MagicTouch — Master Visual & Motion Design System

## 1. Product & Technical Context
You are building **MagicTouch**, an offline-first interactive classroom wall application projected in 16:9 onto school walls (Nursery to Class 12 & Inter) and controlled via a MediaPipe webcam IR pen.
- **Stack:** Plain HTML5, CSS3, and Vanilla JavaScript (ES6+) running in Chrome/Edge. **No frontend frameworks** (no React/Vue/Tailwind). Backed by a local offline Node.js server and JSON-driven activity templates (6 core templates).
- **3D & Media:** Three.js is available for 3D/hologram scenes. Everything must run **100% offline**—never link to external CDNs, external fonts, or remote URLs. All local runtimes (Three.js, dotLottie/lottie-web, Rive WASM) and media assets must be served from the local Node.js server.
- **Multilingual:** Preserve crisp rendering for English (Cambria/Caladea headers, Calibri/Carlito body), Telugu (`Noto Sans Telugu`), and Hindi (`Noto Sans Devanagari`).

## 2. Locked Visual Identity (Do Not Alter)
Always preserve the **Studio** theme, split-screen layout, and high-contrast projector legibility:
- **Palette:** White ground (`#FFFFFF`), soft plum tint (`#F7F1F5`), deep plum ink (`#631654` / `#3D0E37`), magenta (`#CC3054`), orange (`#E96E24`), amber (`#F3A328`), green (`#2FA86A`).
- **IR-Pen Ergonomics:** Keep interactive targets large, generously spaced, and reachable from a distance. Never shrink buttons, sliders, or hitboxes.

## 3. Hybrid Visual & Motion Strategy (80% Code / 20% Local Media)
Never use Flash, heavy GIFs, or static flat clipart. Follow this **Code-First with Plug-and-Play Media** rule:
- **Code 100% by Default (STEM, Economics, UI & Physics):** Build all interactive simulations, particle systems, flowing currents, moving crowds, graphs, and physics confetti using **HTML5 Canvas 2D (`requestAnimationFrame`)**, **layered SVG with gradients/shadows**, **spring-physics CSS/JS** (`cubic-bezier(0.34, 1.56, 0.64, 1)`), and **Procedural Web Audio API** (lightweight synthesized clicks, chimes, and slider-pitch feedback with a global mute toggle).
- **Plug-and-Play Local Media Slots (Early Years, Real-World Visuals & Mascots):** Support optional local license-free media assets inside our JSON activity schemas so we can drop in real-world motion without rewriting templates:
  - **`.mp4` / `.webm` Micro-Loops (2–4 sec):** Muted, seamless, hardware-accelerated local video loops for real-world animals, vehicles, and nature scenes (always preferred over GIFs).
  - **Lottie (`.json` / `.lottie`):** Lightweight vector animations for stickers, badges, and celebratory icons via a local offline player.
  - **Rive (`.riv`):** Optional state-machine vector mascots (e.g., team house mascots) via a local offline runtime.
- **Graceful Fallback Rule:** Every template must work 100% in pure code if no external media file is provided in the JSON, and seamlessly upgrade to the local MP4/Lottie/Rive asset when a `media` path is present.

## 4. World-Class Benchmarks to Emulate
Apply these four UX patterns across our 6 JSON templates:
1. **PhET (Make the Invisible Visible):** Every slider change in STEM & Economics sims must drive continuous real-time physics—flowing electron beads whose speed scales with I = V/R, incandescent bulb filament glow + radial halo, subtle heat shimmer on high-resistance resistors, or buyers physically walking in/out of a market with reaction bubbles when prices change.
2. **Brilliant.org (Tactile Studio Polish):** Pair our clean white Studio aesthetic with subtle depth (ground shadows, soft card elevation), smooth animated number roll-ups, and seamless transitions between `Real` and `Diagram` views.
3. **ExploreLearning Gizmos (Tight Visual-Data Coupling):** Synchronize the left visual stage and right control/graph panel frame-by-frame so dragging a slider updates both the living scene and live readouts simultaneously.
4. **Khan Academy Kids / Duolingo (Early Years Delight):** Use "squash-and-stretch" tap bounces, radial color-flood reveals (transforming grayscale objects into full color or triggering a local MP4/Lottie loop on tap), voice-synced letter tile bounces during phonics playback, and subtle ambient background life (drifting stars, swaying grass).

## 5. Performance & Classroom Hardware Guardrails
Benchmark hardware is a standard Windows laptop, with fallback support for low-end school mini-PCs and Raspberry Pis:
- Target **60fps** using `transform`, `opacity`, and Canvas 2D. Never animate layout properties (`top`, `left`, `width`, `height`).
- Cap simultaneous canvas particles (max 60 confetti pieces, max 40 flow particles).
- Pause `requestAnimationFrame` loops, videos, and Lottie/Rive players when an activity is hidden or paused.
- Respect `prefers-reduced-motion` and expose a `window.MAGICTOUCH_LOW_SPEC` flag that reduces particle counts and glow blur on low-end hardware.

## 6. Delivery Standard
Whenever asked to build or upgrade any template or simulation:
1. Keep the JSON data schema clean and decoupled from the rendering engine, including an optional `media: { type: "mp4" | "lottie" | "rive", src: "/assets/..." }` hook where appropriate.
2. Upgrade static shapes into layered, lit, motion-responsive visuals automatically.
3. Deliver complete, drop-in Vanilla HTML/CSS/JS code with zero external CDN dependencies.

## 7. Frozen Reference Standard (Gold Standard, frozen 2026-11-27)
The Class 10 Ohm's law simulation is frozen as the **MagicTouch Gold Standard**. Its locked reference implementation is `app/public/engine/templates/reference-ohms-law.html` (open `/engine/templates/reference-ohms-law.html` on the local server).
- **Every future template and simulation MUST import the shared Gold Standard layer**:
  - `app/public/shared/studio-base.css` (served as `/shared/studio-base.css`, after `/shared/studio/tokens.css`): split-screen layout (`.st-split`, `.st-split-stage`, `.st-panel`), elevated stage and cards (`.st-stage`, `.st-card`, `.st-goal`, `.st-solved`), IR-pen sliders (`.st-slider`), the Real | Diagram toggle (`.st-toggle`), the sound switch (`.st-sound`), read-outs (`.st-read`) and the graph (`.st-graph`).
  - `app/public/shared/motion-engine.js` (served as `/shared/motion-engine.js`, `import { ME } from "/shared/motion-engine.js"`): `ME.loop` (rAF that pauses when hidden), `ME.ease` roll-ups, `ME.spring`, `ME.burst` (1.2 s canvas confetti celebration), `ME.sound` (the sound cues and the global mute, played by `MagicAudio`, §8), `ME.stage` (elevated, DPR-aware canvas), `ME.graph` (projector-readable graph), `ME.slider`, `ME.toggle`, `ME.soundButton`, `ME.lowSpec()`, `ME.calm()`.
- **Match the reference** in visual polish, typography and motion: Studio palette and fonts; layered, lit Canvas or SVG pictures with soft ground shadows; continuous real-time motion driven by the data (PhET); numbers that roll; a cross-fade between Real and Diagram; the picture and the panel moving in the same frame (Gizmos); a 1.2 s confetti burst and green pulse when a challenge is solved; projector-readable text (graph numbers at least 18 px bold, read-outs at least 28 px); IR-pen targets at least 52 px.
- **Do not copy or re-implement** these controls, loops, sounds or celebrations inside a template. If the shared layer lacks something, add it to `studio-base.css` or `motion-engine.js` so every activity gets it.
- **The reference is locked.** Do not change `reference-ohms-law.html`, or the parts of the shared layer that it uses, in a way that changes its look or motion, without Meeran's written approval.
- Before a new or upgraded template is delivered, compare it side by side with the reference page at 1600×900 and 1366×768. Include screenshots or a short video of both in the pull request.

## 8. Frozen Audio Standard (frozen 2026-11-27)
All voice and sound in MagicTouch goes through one shared module: `app/public/shared/audio-engine.js` (served as `/shared/audio-engine.js`, `import { MagicAudio } from "/shared/audio-engine.js"`, also `window.MagicAudio`).
- **Voice:** every spoken line uses `MagicAudio.speak({ text, lang, clipId })` (inside templates, `MT.speak(...)` is the same call). It plays the pre-generated clip `/assets/voice/{lang}/{clipId}.mp3` when `/assets/voice/manifest.json` lists it, and only otherwise falls back to the best offline `speechSynthesis` voice for `en-IN`, `hi-IN` or `te-IN`. Build lines from reusable parts (`MT.speak(["Yes!", word])`) rather than one-off sentences, so each part is a shared clip. A recorded file of an activity's own goes in `src`.
- **Spelling and letter-by-letter lines:** use `MagicAudio.speakSequence(items, { gap, onPart })` (`MT.speakSequence`): each item waits for the one before it to end (its `ended` event) plus a 120 ms gap, and `onPart(i)` fires as item i starts, so letter tiles bounce in time with the voice. Never time letters with fixed `setTimeout` delays, and never let a new letter cut off the one before it (`speak({ ..., queue: true })` waits its turn). A missing or silent clip is said by the fallback voice for that item only.
- **Theme sounds (real-world):** an activity, item or hotspot may name one with `"sfx": "cat"` (a one-shot: as the activity opens, as its picture is revealed or picked, as it is answered right), and an activity may name a quiet loop with `"ambience": "rain"`. Files are `/assets/sfx/themes/{name}.ogg` (or `.mp3`), CC0, public domain or CC BY (credit given), each listed with source, author and licence in `/assets/sfx/themes/credits.json`; other names for the same file go in `aliases.json`. The server lists the folder, so a dropped-in file works at once. Without a recording, weather, water, machine and vehicle sounds (airplane, helicopter, car, bus, ship, rocket, bicycle, electric, thunder, wind, waves, bee, drum, clock) are made in code by `shared/theme-synth.js`; any other name plays nothing. Play them only with `MagicAudio.playTheme(name)` (`MT.theme`), and an activity's own recording with `MagicAudio.playSound(url)` (`MT.sound`).
- **Background music:** plays into `MagicAudio.musicOut()`, gentle (about a fifth of the voice's loudness), ducked to 30 % while the voice speaks and silent while muted. The Music pill on the early-years top bar turns it on or off.
- **Sound effects:** every cue uses `MagicAudio.playSfx(name)` (or the `ME.sound.*` shortcuts) with one of the six cues: `tap` (IR-pen click), `toggle` (Real | Diagram switch), `tick` (slider notch, `{ pitch: 0…1 }`), `success` (challenge solved), `wrong` (a gentle wooden thud, never a harsh buzzer) and `pop` (hotspots and early-years reveals). Files are CC0 (Kenney) in `/assets/sfx/` (listed in `index.json`); without a file, the engine synthesizes a warm, low-pass filtered sound.
- **Never** call `window.speechSynthesis`, `new Audio(...)` for cues or narration, or raw Web Audio oscillators for UI sounds inside a template, page or simulation. If something is missing (a new cue, a voice option), add it to `audio-engine.js` so every activity gets it. The only exceptions are music-making templates (piano, conductor) and the background music (`shared/studio/soft-music.js`): they use `MagicAudio.context()` and must stay silent while `MagicAudio.muted()`.
- **One global mute:** the Studio speaker button (`ME.soundButton`), the launcher's sound switch and every page share `MagicAudio.muted()` / `setMuted()` (localStorage `mtSfxOn`). Never add a second mute.
- **Voice packs:** `cd app && node scripts/generate-voices.js` (key in the git-ignored `app/.env`, see `app/.env.example`) makes the missing clips for every activity and for `public/assets/voice/phrases.json`. It skips clips already on disk and keeps a monthly character count, so it stays inside Google's free tier. Re-run it after adding or changing activity text. Never commit an API key.

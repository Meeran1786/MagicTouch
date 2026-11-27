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

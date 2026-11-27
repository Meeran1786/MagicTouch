# Bundled third-party libraries (app/public/vendor)

Bundled so the wall runs with no internet. Nothing here is changed; our own code lives
outside this folder.

| Folder | What | Version | Licence |
|---|---|---|---|
| `three/` | three.js (module build) with its GLTFLoader, BufferGeometryUtils and bloom post-processing from `examples/jsm` | 0.170.0 | MIT (see `three/LICENSE`) |
| `mediapipe-tasks/` | MediaPipe Tasks Vision + hand landmarker model | 0.10.14 | Apache-2.0 |
| `twemoji/` | Twemoji SVGs for activity pictures and the moving card pictures (`tools/twemoji.js`) | 15.x | Graphics CC BY 4.0 (© Twitter, Inc. and other contributors) |
| `fonts/` | Caladea, Carlito, Noto Sans Telugu, Noto Sans Devanagari | Google Fonts, Nov 2026 | SIL Open Font License 1.1 |

Caladea and Carlito are metric-compatible with Cambria and Calibri, the brand fonts,
so layouts match on PCs that have the Microsoft fonts installed.

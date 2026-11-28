# Third-party notices

MagicTouch's own code, content and art are owned by Maqsusi EduTech. These bundled parts come from others:

| Part | Where | Licence |
|---|---|---|
| three.js 0.170 + GLTFLoader | `app/public/vendor/three/` | MIT (see `app/public/vendor/three/LICENSE`) |
| MediaPipe Tasks Vision 0.10.14 + hand landmarker model | `app/public/vendor/mediapipe-tasks/` | Apache License 2.0 |
| Twemoji 15 SVGs | `app/public/vendor/twemoji/` | CC BY 4.0, © Twitter, Inc. and other contributors |
| Caladea, Carlito, Noto Sans Telugu, Noto Sans Devanagari | `app/public/vendor/fonts/` | SIL Open Font License 1.1 |
| Interface Sounds 1.0 by Kenney (6 cues: tap, toggle, tick, success, wrong, pop) | `app/public/assets/sfx/` | CC0 1.0 public domain (see `app/public/assets/sfx/LICENSE-Kenney.txt`; credit not required, given anyway) |
| 82 theme sounds from Wikimedia Commons (animals, birds, instruments, phones, vehicles, bells, weather, water, household sounds) | `app/public/assets/sfx/themes/` | CC0 1.0, public domain, or CC BY (dog and donkey: Neumann C, Agil M, Widdig A, Engelhardt A, PLOS ONE 2013, CC BY 2.5; monkey: Furuyama T, Kobayasi K, Riquimaroux H, Scientific Reports 2016, CC BY 4.0; parrot: Bubulcus, CC BY 3.0; 20 more are CC BY-SA and 6 more CC BY, each with its author). The CC BY-SA clips (trimmed) are shared under the same licence. Each was checked on its Commons page on 27–28 Nov 2026; authors, sources and changes are in `app/public/assets/sfx/themes/credits.json` |
| Theme sounds made in code (airplane, helicopter, car, bus, ship, rocket, motorcycle, auto-rickshaw, tractor, race car, speedboat, bicycle bell, electricity, thunder, wind, waves, bubbles, insects, fire, coins, heartbeat, ringtone, robot, magic and more) | `app/public/shared/theme-synth.js` | Original MagicTouch code |
| Pre-generated voice clips (Google Cloud Text-to-Speech, Chirp 3: HD) | `app/public/assets/voice/` | Audio synthesized by Maqsusi EduTech with its own Google Cloud account (`app/scripts/generate-voices.js`) |
| Earth and Moon textures (NASA) | `app/public/engine/assets/` | Public domain (see `app/public/engine/assets/CREDITS.md`) |

Purchased code: `app/public/` started as the Interactive Wall code bought from Basha with a signed IP
assignment (24 Nov 2026). All of its code has since been rewritten to the MagicTouch code standard
(`CODE-STANDARD.md`). Media in it whose original source is not yet confirmed is listed as
`purchased-unverified` in `app/ASSETS-AUDIT.csv`.

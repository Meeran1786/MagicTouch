# MagicTouch

Touch-based interactive learning on a projector wall, by **Maqsusi EduTech** (Hyderabad, India).
A projector shows the activity on a wall; an IR camera sees an IR sensor pen (or a hand) and turns it
into taps and drags. The same JSON-driven engine runs preschool sketches and Classes 1–12 activities.

## What's in this repo

| Folder | What it is |
|---|---|
| `webcam/` | The browser version for a laptop/PC with a USB or IR webcam. Start here. |
| `webcam/poc/` | Classes 1–12 POC: templates in `js/templates/`, activities as JSON in `activities/` |
| `webcam/poc/holo.html` | Hologram view (glowing 3D scenes on black, records video for a hologram fan) |
| `webcam/magictouch_webcam.html` | Preschool sketch app (Nursery–UKG) |
| `webcam/mediapipe/`, `webcam/vendor/` | Bundled libraries so everything runs offline |

## Run it

Needs [Node.js](https://nodejs.org/) and Chrome or Edge.

```
cd webcam
node serve.js
```

Then open **http://localhost:8080/**. Or double-click `webcam/Start MagicTouch (Mac).command` (Mac)
or `webcam/start_magictouch_windows.bat` (Windows). It must be served from localhost, not opened as a
file, or the browser blocks the camera. Full setup and calibration steps are in [`webcam/README.md`](webcam/README.md).

## Adding content

New activities are data, not code: add a JSON file in `webcam/poc/activities/` using an existing
template and list it in `index.json`. All content must be original: no textbook text, pictures or
exercises. Maps of India are left out until an official Survey of India outline is used.

## Ownership

Copyright © Maqsusi EduTech. All rights reserved. Bundled third-party parts are listed in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). Anyone contributing code or content must sign an
IP assignment before starting work.

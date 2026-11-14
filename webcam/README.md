# MagicTouch - webcam version

Classroom activities for Classes 1–12 on a projector wall, driven by an IR pen (or a hand)
seen by a USB/IR webcam on a laptop or PC.

- **http://localhost:8080/** opens the **Classes 1–12 POC**: 12 activities, one per class,
  built on 6 templates (Explore, Match, Sort, Order, Label, Slider simulation).
- **http://localhost:8080/magictouch_webcam.html** is the preschool sketch app (same as the phone app).

## Start it
- **Mac:** double-click `Start MagicTouch (Mac).command`
  (first time: right-click > Open, because macOS blocks downloaded scripts).
- **Windows:** double-click `start_magictouch_windows.bat`.
- **By hand:** in Terminal, `cd` into this folder, run `node serve.js`, then open
  **http://localhost:8080/** in Chrome or Edge.

Allow camera access when asked. It must be http://localhost, not a file:// path,
or the browser blocks the camera.

## First-time setup
1. In the "Camera touch" panel (bottom right), pick the IR camera from the list.
2. Choose the mode: **IR pen** (default) or **hand / finger** (fallback, for a normal webcam).
3. Press **K** to calibrate. Nine dots appear (3 x 3). The red one is the current dot:
   - Pen mode: press the pen on the dot on the wall, then lift it. The next dot turns red.
   - Hand mode: put a fingertip on the dot and hold still until it fills (or press Space).
   Calibration is saved, so you only redo it if the camera or projector moves.
4. Press **C** to hide the panel.

With the pen: press = tap, press and move = drag or draw, lift = release.
If the pen dot isn't detected, lower **Pen sensitivity**. If lights or reflections
cause false touches, raise it. The camera preview shows a red circle where it sees the pen.

## Using the activities
Tap a class tile to open its activity, and **Back** (top right) to return.
To move a card: drag it onto its place, or tap the card and then tap the place.
Sliders: drag the track, or tap the − / + buttons.

## Showcase activities (top row of the menu)
- **Our solar system in 3D**: drag to turn, tap a planet (or its name) to fly there.
- **Launch a satellite**: change the orbit height and meet 3 challenges (real orbit physics).
- **Torch: hidden life in a pond**: shine a torch on the line drawing; hold it still to find 6 hidden animals.
  Works with an IR torch, the IR pen held on, or the mouse. In this activity the camera also follows a big torch spot.
- **Hit the answer**: balloons with answers float up; hit the right one. For now a pen tap or click counts as a hit;
  detecting a thrown ball with the camera is the next step, once we can test with the real camera.

## Hologram view (for a hologram fan)
Open **http://localhost:8080/poc/holo.html** (or press "Hologram view" in a 3D activity).
Keys: 1 solar system, 2 Earth and Moon, 3 Saturn, 4 Jupiter, 5 satellite, 6 Sun, L name on/off,
R records a 20-second video to put on the fan, F fullscreen, H hide help. Black shows as see-through on the fan.

## Adding an activity
Each activity is one JSON file in `poc/activities/` (listed in `poc/activities/index.json`).
Copy an existing file of the same template, change the text, and add its name to the index.
All content must be original: no textbook text, pictures or exercises.

Every activity also carries:
- **`concept`**: an id from `poc/data/concepts.json` (add the concept there first if it's new).
  Boards are mapped to concepts in `poc/data/board-map.json`, so one activity serves every board.
- **`status`**: `draft` → `review` → `approved`. Only Meeran sets `approved`, after checking accuracy
  and grade fit and trying it on the wall. Tiles that aren't approved show a yellow **Draft** badge.

**Demo mode:** open **http://localhost:8080/poc/?demo** to list only approved activities (for school demos).

**Check before testing:** run `node tools/check-activities.js` in this folder. It reports files missing
from the index, duplicate ids, unknown templates or concepts, and missing fields.

Keys: C = show/hide panel, K = calibrate, P = switch pen/hand mode,
Space = capture the current dot (hand mode), Esc = cancel calibration.

Sound needs one real click on the page in a normal browser window; the launchers
open the browser with autoplay allowed so this isn't needed there.

Works offline: the hand-tracking model (MediaPipe Hands, Apache-2.0) is in `mediapipe/`.

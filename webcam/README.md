# MagicTouch - webcam version

Classroom activities for Classes 1–12 on a projector wall, driven by an IR pen (or a hand)
seen by a USB/IR webcam on a laptop or PC.

- **http://localhost:8080/** opens the **Classes 1–12 POC**: 12 activities, one per class,
  built on 6 templates (Explore, Match, Sort, Order, Label, Slider simulation), plus a
  **chapter lesson pack** (Class 10 Electricity) and a **map explorer** (Class 4 town map).
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
from the index, duplicate ids, unknown templates or concepts, missing fields, formulas that don't work,
quiz answers that point outside the options, map regions with no shape, and pack steps that point nowhere.

### Chapter lesson packs, quizzes, predictions and worked solutions
All of these are data in the activity file; no new code per topic. See
`poc/activities/p10-science-electricity.json` for a full example.

- **Lesson pack** (`"template": "pack"`): a chapter as a row of steps, e.g. explore → simulate → order → quiz.
  Each step is `{"label": "Explore", "activity": {…any other template…}}`, or `{"label": "…", "ref": "<activity id>"}`
  to reuse an existing activity. Finishing a step offers **Next step**; the end shows a chapter summary with the quiz marks.
- **Quiz** (`"template": "quiz"`): board-style questions with big answer cards, the reason after each answer,
  marks and a review at the end. Kinds: multiple choice (`q`, `options`, `answer` index), `"type": "truefalse"`,
  and `"type": "assertion"` (assertion–reason with the standard four choices).
- **Predict, then watch** (in `simulate`): `"predict": [{"text", "set", "then", "options", "answer", "explain"}]`.
  Sliders lock, the student picks a prediction, the sliders move by themselves to show what happens, then the
  explanation appears. Challenges start after the last prediction.
- **Live worked solution** (in `simulate`): `"solution": {"lines": ["I = V ÷ R", "I = {V} ÷ {R}", "I = {V/R:2} A"]}`.
  Anything in `{…}` is a formula on the slider values (`:2` = 2 decimals); lines update as the sliders move.
- **Formula simulations** (`"model": "formula"`): give `"formulas": {"Rs": "R1 + R2"}` and either a `"picture"`
  (an SVG whose `{…}` parts follow the sliders) or `"display"` read-outs. This makes a new simulation without code.
- **Map explorer** (`"template": "map"`): an SVG map where each place has `data-region="id"`, a `regions` list,
  and an optional `find` round ("Tap the place north of the park"). **Maps of India, or anything showing India's
  borders, must use an official Survey of India outline**; until we have one, only fictional or local maps.

Keys: C = show/hide panel, K = calibrate, P = switch pen/hand mode,
Space = capture the current dot (hand mode), Esc = cancel calibration.

Sound needs one real click on the page in a normal browser window; the launchers
open the browser with autoplay allowed so this isn't needed there.

Works offline: the hand-tracking model (MediaPipe Hands, Apache-2.0) is in `mediapipe/`.

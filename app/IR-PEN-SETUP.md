# IR pen mode

The wall uses an **IR pen + IR webcam** by default. One input module turns the pen (or a hand)
into ordinary taps and drags for every activity: `public/shared/input/`.

## First run

1. Open the wall, allow the camera. If a camera is named "IR"/"infrared" it is picked automatically;
   otherwise press **Shift+C** to cycle cameras (the page reloads on the one you want).
2. Calibration runs **once, full screen, before any app opens** (page `/calibrate/`, started by the launcher).
   Touch the pen to each pulsing dot and hold it still for 2 s. If the pen is not seen for 3 s,
   the live camera view opens by itself (bottom-left) so you can see what the camera sees.
   IR mode keeps its **own** calibration (`wallSharedCalibrationIR`), so the old finger calibration is untouched.
3. To recalibrate: **⌂ → 🎯 Calibrate the wall**, or press **R** inside any app (the launcher then opens
   the full-screen calibration instead of calibrating inside the app).

## Tuning keys (remembered, shared by every app)

| Keys              | What it does                                    |
| ----------------- | ----------------------------------------------- |
| Shift+D           | live camera preview with the detected pen dot   |
| Shift+↑ / Shift+↓ | less / more sensitive (brightness threshold ±5) |
| Shift+C           | next camera                                     |

If the dot is not found, lower the threshold (Shift+↓). If lamps/reflections are picked up, raise it.
Dots larger than ~2500 px (lamps, windows) are ignored automatically.

## Switching back to fingers

Open any page once with `?input=hand` (and `?input=irpen` to return). The choice is remembered.

## Files

- `public/shared/input/config.js` — mode switch (IR pen, hand, mouse), settings, tracker factory
- `public/shared/input/ir-pen-tracker.js` — IR dot detection; several pens at once for multi-pen games
- `public/shared/input/hand-tracker.js` — MediaPipe hand tracking (same contract as the pen tracker)
- `public/shared/input/homography.js` — camera-to-screen maths
- `public/shared/input/calibration.js` — the 9-dot calibration used by `/calibrate/`
- `public/shared/input/pointer.js` — turns the pen or hand into pointer and click events for every activity

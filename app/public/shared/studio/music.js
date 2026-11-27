// Background music for the early-years activities: our own soft generated piece
// (soft-music.js). The school turns it on or off in the launcher settings; the toggle on
// an activity's top bar flips the same setting, so the choice is shared across the wall.
import { createSoftMusic } from "./soft-music.js";

const KEY = "wallBgMusicOn";
let music = null;

/** Music is on unless the school or a teacher turned it off. */
export function musicWanted() {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function setMusicWanted(on) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* storage blocked */
  }
  if (music) music.setMuted(!on);
}

/** Starts the music for an activity that wants it (it waits for the first tap if audio is locked). */
export function startMusic() {
  if (!music) music = createSoftMusic({ volume: 0.14 });
  music.setMuted(!musicWanted());
  music.start().then((ok) => {
    if (!ok) window.addEventListener("pointerdown", () => music && music.start(), { once: true });
  });
}

export function stopMusic() {
  if (music) music.stop();
}

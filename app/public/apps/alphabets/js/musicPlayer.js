// ═══════════════════════════════════════════════════════════════
//  musicPlayer.js — background music for the wall. MagicTouch: now our own
//  generated soft music (shared/studio/soft-music.js); Spring.mp3 had no licence record.
//  Must be started from a user gesture (the "Start camera & begin"
//  click satisfies browser autoplay rules).
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = "wallAlphabetsMusicOn";
import { createSoftMusic } from "/shared/studio/soft-music.js";
const VOLUME = 0.35;

export class MusicPlayer {
  constructor() {
    this.audio = null;
    this.playing = false;
  }

  _ensureAudio() {
    if (this.audio) return;
    const music = createSoftMusic({ volume: VOLUME * 0.5 });
    this.audio = {
      async play() { if (!(await music.start())) throw new Error("waiting for a tap"); music.setMuted(false); },
      pause() { music.setMuted(true); },
    };
  }

  async play() {
    this._ensureAudio();
    if (this.playing) return;
    try {
      await this.audio.play();
      this.playing = true;
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch (e) {}
    } catch (e) {
      // Autoplay blocked or file missing — stay muted, no crash.
      console.warn("[warn] could not start background music:", e);
    }
  }

  pause() {
    this.playing = false;
    if (this.audio) this.audio.pause();
    try { localStorage.setItem(STORAGE_KEY, "0"); } catch (e) {}
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
    return this.playing;
  }

  static wantsMusic() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === null ? true : v === "1"; // default ON
    } catch (e) {
      return true;
    }
  }
}

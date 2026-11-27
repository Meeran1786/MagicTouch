// Tells a spoken MP3 clip from a silent one without decoding it (no libraries, no ffmpeg).
// Every MP3 (Layer III) frame stores a global_gain: the loudness scale of its samples. A frame
// of speech needs a high gain; a silent frame a low one. Calibrated on the 1,481 Google Chirp 3: HD
// clips (24 kHz mono, 32 kbit/s, checked against ffmpeg volumedetect, 2026-11-28): the 13 silent
// clips Google returned (max volume below -38 dB) all have a highest gain of 162 or less; every
// spoken clip has 166 or more. Granules that code no sound at all (pure digital silence) are left out.
//
//   import { mp3Gain, isSilent } from "./mp3-voice-check.js";
//   isSilent(buffer)  → true when the clip has no speech in it

const BITRATES = {
  // [MPEG-1 Layer III, MPEG-2/2.5 Layer III] in kbit/s, by index 1…14
  1: [32, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  2: [8, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** { seconds, frames, maxGain, p90Gain, bitsPerSecond } of an MP3 file. */
export function mp3Gain(buf) {
  let i = 0,
    bits = 0,
    seconds = 0,
    frames = 0,
    maxGain = 0;
  const gains = [];
  // skip an ID3v2 tag
  if (buf.length > 10 && buf.toString("latin1", 0, 3) === "ID3")
    i = 10 + ((buf[6] & 127) << 21) + ((buf[7] & 127) << 14) + ((buf[8] & 127) << 7) + (buf[9] & 127);
  while (i + 4 < buf.length) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) {
      i++;
      continue;
    }
    const ver = (buf[i + 1] >> 3) & 3, // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
      layer = (buf[i + 1] >> 1) & 3, // 1 = Layer III
      crc = !(buf[i + 1] & 1),
      bri = buf[i + 2] >> 4,
      sri = (buf[i + 2] >> 2) & 3,
      pad = (buf[i + 2] >> 1) & 1,
      mono = buf[i + 3] >> 6 === 3;
    if (ver === 1 || layer !== 1 || bri === 0 || bri === 15 || sri === 3) {
      i++;
      continue;
    }
    const mpeg1 = ver === 3,
      rate = RATES[ver][sri],
      kbps = BITRATES[mpeg1 ? 1 : 2][bri - 1],
      len = Math.floor(((mpeg1 ? 144 : 72) * kbps * 1000) / rate) + pad;
    if (len < 8) break;
    // side information: read part2_3_length of every granule and channel
    let p = (i + 4 + (crc ? 2 : 0)) * 8;
    const bit = (n) => {
      let v = 0;
      for (let k = 0; k < n; k++, p++) v = (v << 1) | ((buf[p >> 3] >> (7 - (p & 7))) & 1);
      return v;
    };
    const ch = mono ? 1 : 2,
      granules = mpeg1 ? 2 : 1;
    if (mpeg1) bit(mono ? 9 + 5 + 4 : 9 + 3 + 8);
    else bit(mono ? 8 + 1 : 8 + 2);
    for (let g = 0; g < granules; g++)
      for (let c = 0; c < ch; c++) {
        const used = bit(12); // part2_3_length: bits of coded sound in this granule
        bits += used;
        bit(9); // big_values
        const gain = bit(8); // global_gain: the loudness scale of this granule
        // a granule of pure digital silence codes nothing (0 bits) and its gain means nothing
        if (used > 0) {
          if (gain > maxGain) maxGain = gain;
          gains.push(gain);
        }
        bit(mpeg1 ? 30 : 34); // the rest of this granule/channel's side info
      }
    seconds += (mpeg1 ? 1152 : 576) / rate;
    frames++;
    i += len;
  }
  gains.sort((a, b) => a - b);
  const p90 = gains.length ? gains[Math.floor(gains.length * 0.9)] : 0;
  return { seconds, frames, bitsPerSecond: seconds ? bits / seconds : 0, maxGain, p90Gain: p90 };
}

/** True when an MP3 clip holds no speech (or is not an MP3 at all). */
export function isSilent(buf, minGain = 164) {
  const v = mp3Gain(buf);
  return v.frames < 3 || v.maxGain < minGain;
}

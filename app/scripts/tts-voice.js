// The Google Text-to-Speech request for one line, shared by generate-voices.js and voice-audition.js.
// A voice is either a Google voice name ("hi-IN-Wavenet-A", "te-IN-Chirp3-HD-Kore") or a Gemini
// voice written as "<model>:<voice>" ("gemini-2.5-flash-tts:Kore"). A Gemini voice also gets a short
// style note (TTS_PROMPT_HI_IN etc. in .env, or the default below) so it speaks like a native
// teacher rather than reading the word out.

export const DEFAULT_PROMPTS = {
  "en-IN": "Say this clearly and warmly in Indian English, like a friendly nursery teacher talking to young children.",
  "hi-IN":
    "Say this in natural, everyday Hindi with a native Indian accent, clearly and warmly, like a friendly nursery teacher talking to young children.",
  "te-IN":
    "Say this in natural, everyday Telugu with a native Telugu accent, clearly and warmly, like a friendly nursery teacher talking to young children.",
};

/** "gemini-2.5-flash-tts:Kore" → { model, name }; a plain Google voice name → { name }. */
export function parseVoice(voice) {
  const m = /^([a-z0-9.-]*tts[a-z0-9.-]*):(.+)$/i.exec(String(voice || ""));
  return m ? { model: m[1], name: m[2] } : { name: String(voice || "") };
}

/** The JSON body for texttospeech.googleapis.com/v1/text:synthesize. */
export function requestBody(voice, lang, text, rate) {
  const v = parseVoice(voice);
  const input = { text };
  const sel = { languageCode: lang, name: v.name };
  if (v.model) {
    sel.modelName = v.model;
    input.prompt = process.env["TTS_PROMPT_" + lang.replace("-", "_").toUpperCase()] || DEFAULT_PROMPTS[lang] || "";
  }
  return {
    input,
    voice: sel,
    audioConfig: { audioEncoding: "MP3", ...(rate ? { speakingRate: rate } : {}) },
  };
}

// What dictation decides (voice-input), apart from the microphone and the screen: the WAV file the host's engine
// reads, how the heard words sit in the message box, and the plain-words reasons the owner reads.

/** Where a dictation is: nothing going on, the host being asked, the microphone listening, or the host transcribing. */
export type DictationPhase = "Idle" | "Checking" | "Listening" | "Transcribing";

/** Samples from -1 to 1 as a mono, 16-bit PCM WAV file, the layout whisper.cpp reads. */
export const wavOf = (samples: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> => {
  const dataBytes = samples.length * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, dataBytes, true);
  samples.forEach((sample, index) => {
    // A loud input can pass full scale; clamped, it stays a loud sample instead of wrapping to its opposite.
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  });
  return bytes;
};

/**
 * The recording at the engine's rate. The window asks the microphone for that rate and usually gets it; when it gets
 * another, each window of samples is averaged into one, which also keeps the high pitches from folding back as noise.
 */
export const resampledOf = (samples: Float32Array, fromRate: number, toRate: number): Float32Array => {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const resampled = new Float32Array(Math.floor(samples.length / ratio));
  resampled.forEach((_, index) => {
    const start = Math.floor(index * ratio);
    const end = Math.max(start + 1, Math.floor((index + 1) * ratio));
    let sum = 0;
    for (let at = start; at < end; at++) sum += samples[at] ?? 0;
    resampled[index] = sum / (end - start);
  });
  return resampled;
};

/** The words as they go in at the caret: trimmed, with a space where they would touch the text on either side. */
export const spacedTranscriptOf = (before: string, after: string, spoken: string): string => {
  const words = spoken.trim();
  const leading = before === "" || /\s$/.test(before) ? "" : " ";
  const trailing = after === "" || /^\s/.test(after) ? "" : " ";
  return `${leading}${words}${trailing}`;
};

/** The engine's own markers for what is not speech, such as `[BLANK_AUDIO]` for silence. */
const engineMarkers = /\[[A-Z_ ]+\]/g;

/** What the engine heard: the words to put in the box, or why there are none. */
export const transcriptOutcomeOf = (
  heard: string,
): { readonly reason: string | null; readonly text: string | null } => {
  const text = heard.replace(engineMarkers, " ").replace(/\s+/g, " ").trim();
  return text === "" ? { reason: "No words were heard.", text: null } : { reason: null, text };
};

const refusedAccess =
  "Outlore may not use the microphone. Allow it in System Settings › Privacy & Security › Microphone.";
const microphoneRefusals: Readonly<Record<string, string>> = {
  NotAllowedError: refusedAccess,
  NotFoundError: "No microphone was found.",
  SecurityError: refusedAccess,
};

/** Why the microphone could not be used, from the browser's error name, in plain words. */
export const microphoneRefusalOf = (errorName: string): string =>
  (Object.hasOwn(microphoneRefusals, errorName) ? microphoneRefusals[errorName] : null) ??
  "The microphone could not be used.";

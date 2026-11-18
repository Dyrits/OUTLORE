import { dictationSampleRate } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import {
  microphoneRefusalOf,
  resampledOf,
  spacedTranscriptOf,
  transcriptOutcomeOf,
  wavOf,
} from "../../src/dictation/dictation";

describe("encoding a dictation as a WAV file", () => {
  it("writes a 16 kHz, mono, 16-bit PCM header and one sample per two bytes", () => {
    const wav = wavOf(new Float32Array([0, 0.5, -0.5, 1]), dictationSampleRate);
    const view = new DataView(wav.buffer);
    const text = (offset: number) =>
      String.fromCharCode(...Array.from(wav.subarray(offset, offset + 4)).map((byte) => byte));
    expect(text(0)).toBe("RIFF");
    expect(text(8)).toBe("WAVE");
    expect(text(12)).toBe("fmt ");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(36)).toBe("data");
    expect(view.getUint32(40, true)).toBe(8);
    expect(wav.byteLength).toBe(52);
  });

  it("clamps samples past full scale instead of wrapping them around", () => {
    const wav = wavOf(new Float32Array([2, -2, 0.5]), dictationSampleRate);
    const view = new DataView(wav.buffer);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
    expect(view.getInt16(48, true)).toBe(16383);
  });
});

describe("bringing a recording to the engine's sample rate", () => {
  it("keeps a recording already at 16 kHz as it is", () => {
    const samples = new Float32Array([0.1, 0.2, 0.3]);
    expect(resampledOf(samples, 16000, 16000)).toBe(samples);
  });

  it("averages each window of a 48 kHz recording into one sample", () => {
    const samples = new Float32Array([0, 0.3, 0.6, 1, 1, 1]);
    const resampled = resampledOf(samples, 48000, 16000);
    expect(resampled.length).toBe(2);
    expect(resampled[0]).toBeCloseTo(0.3);
    expect(resampled[1]).toBeCloseTo(1);
  });
});

describe("placing the words in the message box", () => {
  it("adds the words as they are into an empty box or after a space", () => {
    expect(spacedTranscriptOf("", "", " Hello there. ")).toBe("Hello there.");
    expect(spacedTranscriptOf("Look at ", "", "this")).toBe("this");
  });

  it("keeps the words apart from the text on each side of the caret", () => {
    expect(spacedTranscriptOf("Look at", "please", "this")).toBe(" this ");
    expect(spacedTranscriptOf("line\n", " end", "this")).toBe("this");
  });
});

describe("reading what the engine heard", () => {
  it("gives the words to put in the box", () => {
    expect(transcriptOutcomeOf("  Fix the sidebar.  ")).toEqual({ reason: null, text: "Fix the sidebar." });
  });

  it("says no words were heard rather than putting nothing in the box", () => {
    expect(transcriptOutcomeOf("   ")).toEqual({ reason: "No words were heard.", text: null });
  });

  it("drops the engine's markers for silence and noise", () => {
    expect(transcriptOutcomeOf("[BLANK_AUDIO]")).toEqual({ reason: "No words were heard.", text: null });
    expect(transcriptOutcomeOf("[BLANK_AUDIO] Hello")).toEqual({ reason: null, text: "Hello" });
  });
});

describe("explaining why the microphone could not be used", () => {
  it("points to the system's privacy settings when access was refused", () => {
    expect(microphoneRefusalOf("NotAllowedError")).toContain("Privacy & Security");
  });

  it("says no microphone was found when there is none", () => {
    expect(microphoneRefusalOf("NotFoundError")).toBe("No microphone was found.");
  });

  it("gives a general reason for any other failure", () => {
    expect(microphoneRefusalOf("AbortError")).toBe("The microphone could not be used.");
  });
});

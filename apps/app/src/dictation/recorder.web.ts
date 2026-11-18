import { dictationSampleRate, maxDictationSeconds } from "@outlore/contracts";
import { resampledOf, wavOf } from "./dictation";
import type { Recording } from "./recorderTypes";

// The microphone in the desktop window (voice-input): raw samples are taken from the audio graph, so no codec is
// involved and the file the host's engine reads is built here. The samples stay in memory and leave the window only
// as the one recording sent to the host for transcription.

/**
 * Dictation runs in the desktop window for now (owner, 2026-11-18): a paired browser and the phone come in later
 * batches (voice-input draft), so a page with no desktop bridge offers no microphone.
 */
export const isRecordingSupported =
  typeof window !== "undefined" &&
  window.outlore !== undefined &&
  typeof navigator !== "undefined" &&
  navigator.mediaDevices?.getUserMedia !== undefined;

/** Samples per block the audio graph hands over; about a quarter of a second at the engine's rate. */
const blockSize = 4096;

/**
 * Opens the microphone and records until `stop` or `cancel`. `onLimit` is called once the longest dictation is
 * reached, so the caller stops it as it would on a press. Rejects with the browser's error when the microphone cannot open.
 */
export const startRecording = async (onLimit: () => void): Promise<Recording> => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const context = new AudioContext({ sampleRate: dictationSampleRate });
  const source = context.createMediaStreamSource(stream);
  // Deprecated in favour of audio worklets, which need a module file of their own; this node still runs in Chromium
  // and is enough for one microphone at a low rate.
  const processor = context.createScriptProcessor(blockSize, 1, 1);
  const blocks: Float32Array[] = [];
  const limit = maxDictationSeconds * context.sampleRate;
  let count = 0;
  let hasReachedLimit = false;
  processor.onaudioprocess = (event) => {
    const block = new Float32Array(event.inputBuffer.getChannelData(0));
    blocks.push(block);
    count += block.length;
    if (count >= limit && !hasReachedLimit) {
      hasReachedLimit = true;
      onLimit();
    }
  };
  source.connect(processor);
  // The node only runs while connected to an output; it writes nothing to it, so nothing is heard.
  processor.connect(context.destination);
  let isReleased = false;
  const release = () => {
    if (isReleased) return;
    isReleased = true;
    processor.onaudioprocess = null;
    processor.disconnect();
    source.disconnect();
    for (const track of stream.getTracks()) track.stop();
    void context.close();
  };
  return {
    cancel: () => {
      release();
      blocks.length = 0;
    },
    stop: () => {
      const rate = context.sampleRate;
      release();
      const samples = new Float32Array(count);
      let offset = 0;
      for (const block of blocks) {
        samples.set(block, offset);
        offset += block.length;
      }
      blocks.length = 0;
      return samples.length === 0 ? null : wavOf(resampledOf(samples, rate, dictationSampleRate), dictationSampleRate);
    },
  };
};

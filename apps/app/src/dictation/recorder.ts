import type { Recording } from "./recorderTypes";

// The phone records through a native module of its own, which a later batch adds (voice-input draft, "Phone:
// transcription on the phone itself"); until then a native app offers no microphone.

/** Whether this app can record a dictation: not yet on a phone. */
export const isRecordingSupported = false;

/** Refuses: there is no recorder on a phone yet. */
export const startRecording = (_onLimit: () => void): Promise<Recording> =>
  Promise.reject(new Error("Dictation is not available in this app yet."));

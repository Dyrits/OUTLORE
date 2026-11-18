import { Schema } from "effect";

// Dictation (voice-input): the owner speaks a message, the host transcribes it with whisper.cpp, and the words land in
// the message box. Only the recording travels, as one WAV file the engine reads as is (ADR 0024).

/** The sample rate the recording is made at: the one whisper.cpp reads. */
export const dictationSampleRate = 16000;
/** The longest one dictation records before it stops by itself, in seconds. */
export const maxDictationSeconds = 5 * 60;
/** The largest recording the service takes: the longest dictation as 16-bit mono samples, with its header. */
export const maxDictationBytes = 44 + maxDictationSeconds * dictationSampleRate * 2;

/** Whether dictation can run on the host now; when it cannot, why, in plain words for the owner. */
export const DictationStatus = Schema.Struct({ unavailableReason: Schema.NullOr(Schema.String) });
export type DictationStatus = typeof DictationStatus.Type;

/** What the engine heard; empty when it heard no words. */
export const Transcript = Schema.Struct({ text: Schema.String });
export type Transcript = typeof Transcript.Type;

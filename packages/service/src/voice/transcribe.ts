import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { Config, Effect, Schema } from "effect";

// Speech to text on the owner's computer (voice-input): whisper.cpp's command-line tool reads a 16 kHz, mono,
// 16-bit WAV file and prints its transcript. Nothing is sent to a vendor (ADR 0024). This batch runs the tool
// that the owner's environment names; bundling it and its model with the app comes later.

/** A transcription that did not happen, with the reason in plain words for the owner. */
export class TranscriptionFailure extends Schema.TaggedError<TranscriptionFailure>()("TranscriptionFailure", {
  reason: Schema.String,
}) {}

/** The one WAV layout the engine is given: 16 kHz, mono, 16-bit PCM. */
export const engineSampleRate = 16000;

/** What a WAV file holds, once it has been checked. */
export type WavFormat = {
  readonly bitsPerSample: number;
  readonly channels: number;
  readonly dataBytes: number;
  readonly sampleRate: number;
};

/** Where the engine and its model are, and how it runs. */
export type TranscriberSettings = {
  /** The whisper.cpp command-line tool (`whisper-cli`). */
  readonly binary: string;
  /** The language to read, or `auto` to detect it. */
  readonly language: string;
  /** Whether the tool may use the graphics processor (Metal on a Mac). */
  readonly shouldUseGpu: boolean;
  /** The ggml model file, for example `ggml-base.bin`. */
  readonly model: string;
};

/** Longest the engine may run on one recording before it is stopped. */
export const transcribeTimeoutMs = 5 * 60 * 1000;

const ascii = (view: DataView, offset: number): string =>
  String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );

/**
 * Checks a WAV file's header and returns its format. A file the engine cannot read is refused here with the reason,
 * so the owner sees why dictation did not work instead of an empty transcript.
 */
export const checkWav = Effect.fnUntraced(function* (bytes: Uint8Array) {
  if (bytes.byteLength < 12)
    return yield* new TranscriptionFailure({ reason: "The recording is too short to be a WAV file." });
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (ascii(view, 0) !== "RIFF" || ascii(view, 8) !== "WAVE") {
    return yield* new TranscriptionFailure({ reason: "The recording is not a WAV file." });
  }
  let format: { audioFormat: number; bitsPerSample: number; channels: number; sampleRate: number } | null = null;
  let dataBytes: number | null = null;
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const id = ascii(view, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt " && size >= 16 && body + 16 <= bytes.byteLength) {
      format = {
        audioFormat: view.getUint16(body, true),
        bitsPerSample: view.getUint16(body + 14, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
      };
    }
    if (id === "data") {
      if (body + size > bytes.byteLength) {
        return yield* new TranscriptionFailure({ reason: "The recording is cut short." });
      }
      dataBytes = size;
    }
    offset = body + size + (size % 2);
  }
  if (format === null || dataBytes === null) {
    return yield* new TranscriptionFailure({ reason: "The recording has no audio data." });
  }
  if (format.audioFormat !== 1) {
    return yield* new TranscriptionFailure({ reason: "The recording is not uncompressed PCM audio." });
  }
  if (format.sampleRate !== engineSampleRate || format.channels !== 1 || format.bitsPerSample !== 16) {
    return yield* new TranscriptionFailure({
      reason: `The recording must be ${engineSampleRate} Hz, mono, 16-bit; it is ${format.sampleRate} Hz, ${format.channels} channel(s), ${format.bitsPerSample}-bit.`,
    });
  }
  if (dataBytes === 0) return yield* new TranscriptionFailure({ reason: "The recording is empty." });
  return { bitsPerSample: format.bitsPerSample, channels: format.channels, dataBytes, sampleRate: format.sampleRate };
});

/**
 * Runs the engine on one WAV file and returns the transcript: the text it prints, trimmed. Silence gives an empty
 * text, which the caller decides how to show. Any failure to start, a non-zero exit, or the time limit is a
 * `TranscriptionFailure`; nothing is retried.
 */
export const transcribeWav = Effect.fnUntraced(function* (wavPath: string, settings: TranscriberSettings) {
  const bytes = yield* Effect.tryPromise({
    catch: () => new TranscriptionFailure({ reason: "The recording could not be read." }),
    try: () => readFile(wavPath),
  });
  yield* checkWav(bytes);
  const args = [
    "-m",
    settings.model,
    "-f",
    wavPath,
    "-l",
    settings.language,
    "-np",
    "-nt",
    ...(settings.shouldUseGpu ? [] : ["-ng"]),
  ];
  const stdout = yield* Effect.tryPromise({
    catch: (error) =>
      new TranscriptionFailure({
        reason:
          error instanceof Error && "killed" in error && error.killed === true
            ? "The transcriber ran past its time limit and was stopped."
            : "The transcriber did not finish.",
      }),
    try: () =>
      new Promise<string>((resolve, reject) => {
        execFile(
          settings.binary,
          args,
          { maxBuffer: 1024 * 1024, timeout: transcribeTimeoutMs, windowsHide: true },
          (error, out) => {
            if (error === null) resolve(out);
            else reject(error);
          },
        );
      }),
  });
  return stdout.trim();
});

/**
 * The transcriber's settings from the environment: OUTLORE_WHISPER_CLI and OUTLORE_WHISPER_MODEL are required,
 * OUTLORE_WHISPER_LANGUAGE defaults to `auto` and OUTLORE_WHISPER_GPU to true. A missing setting is an ordinary
 * failure of the read, not a crash at start.
 */
export const readTranscriberSettings = Config.all({
  binary: Config.String("OUTLORE_WHISPER_CLI"),
  language: Config.String("OUTLORE_WHISPER_LANGUAGE").pipe(Config.withDefault("auto")),
  model: Config.String("OUTLORE_WHISPER_MODEL"),
  shouldUseGpu: Config.Boolean("OUTLORE_WHISPER_GPU").pipe(Config.withDefault(true)),
});

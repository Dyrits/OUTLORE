import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Exit } from "effect";

/** Reads the transcriber's settings from the given variables only, as the environment would give them. */
const withVariables = (variables: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(variables));

import {
  checkWav,
  readTranscriberSettings,
  type TranscriptionFailure,
  transcribeWav,
} from "../../src/voice/transcribe.ts";

/** A WAV file with a `fmt ` chunk and a `data` chunk, with the given format and sample bytes. */
const wav = (options: {
  readonly audioFormat?: number;
  readonly bitsPerSample?: number;
  readonly channels?: number;
  readonly dataBytes?: number;
  readonly sampleRate?: number;
}): Uint8Array => {
  const sampleRate = options.sampleRate ?? 16000;
  const channels = options.channels ?? 1;
  const bits = options.bitsPerSample ?? 16;
  const data = options.dataBytes ?? 3200;
  const bytes = new Uint8Array(44 + data);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < 4; index++) view.setUint8(offset + index, value.charCodeAt(index));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + data, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, options.audioFormat ?? 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, (sampleRate * channels * bits) / 8, true);
  view.setUint16(32, (channels * bits) / 8, true);
  view.setUint16(34, bits, true);
  text(36, "data");
  view.setUint32(40, data, true);
  return bytes;
};

const failureOf = (effect: Effect.Effect<unknown, TranscriptionFailure>) => Effect.runSyncExit(effect);

describe("checking a recording's WAV header", () => {
  it.effect("accepts 16 kHz, mono, 16-bit PCM and reports its format", () =>
    Effect.gen(function* () {
      const format = yield* checkWav(wav({ dataBytes: 3200 }));
      expect(format).toEqual({ bitsPerSample: 16, channels: 1, dataBytes: 3200, sampleRate: 16000 });
    }),
  );

  it("refuses a file that is not a WAV file", () => {
    const exit = failureOf(checkWav(new TextEncoder().encode("not audio at all, just text")));
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("refuses stereo, another sample rate, another bit depth, and compressed audio, each with its reason", () => {
    for (const options of [{ channels: 2 }, { sampleRate: 44100 }, { bitsPerSample: 8 }, { audioFormat: 85 }]) {
      const exit = failureOf(checkWav(wav(options)));
      expect(Exit.isFailure(exit)).toBe(true);
    }
  });

  it("refuses an empty recording and one whose data is cut short", () => {
    expect(Exit.isFailure(failureOf(checkWav(wav({ dataBytes: 0 }))))).toBe(true);
    const cut = wav({ dataBytes: 3200 }).slice(0, 100);
    expect(Exit.isFailure(failureOf(checkWav(cut)))).toBe(true);
  });
});

describe("reading the transcriber's settings", () => {
  it.effect("fails as an ordinary failure when the engine path is not set", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(readTranscriberSettings.pipe(withVariables({ OUTLORE_WHISPER_MODEL: "/m.bin" })));
      expect(Exit.isFailure(exit)).toBe(true);
    }),
  );

  it.effect("defaults the language to auto and the GPU to on", () =>
    Effect.gen(function* () {
      const settings = yield* readTranscriberSettings.pipe(
        withVariables({ OUTLORE_WHISPER_CLI: "/bin/whisper-cli", OUTLORE_WHISPER_MODEL: "/m.bin" }),
      );
      expect(settings).toEqual({ binary: "/bin/whisper-cli", language: "auto", model: "/m.bin", shouldUseGpu: true });
    }),
  );
});

// The engine itself runs only where its paths are given: OUTLORE_WHISPER_CLI, OUTLORE_WHISPER_MODEL, and a 16 kHz
// mono WAV in OUTLORE_WHISPER_SAMPLE (whisper.cpp ships samples/jfk.wav). Each run is a real transcription.
const engine = {
  binary: process.env.OUTLORE_WHISPER_CLI,
  model: process.env.OUTLORE_WHISPER_MODEL,
  sample: process.env.OUTLORE_WHISPER_SAMPLE,
};
const hasEngine = Boolean(engine.binary && engine.model && engine.sample);

describe.skipIf(!hasEngine)("transcribing a recording with whisper.cpp", () => {
  it.live("returns the words of a known English recording", () =>
    Effect.gen(function* () {
      const transcript = yield* transcribeWav(engine.sample ?? "", {
        binary: engine.binary ?? "",
        language: "en",
        model: engine.model ?? "",
        shouldUseGpu: process.env.OUTLORE_WHISPER_GPU !== "false",
      });
      expect(transcript.toLowerCase()).toContain("ask not what your country can do for you");
    }),
  );

  it.live("fails with a plain reason when the recording does not exist", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        transcribeWav("/does/not/exist.wav", {
          binary: engine.binary ?? "",
          language: "en",
          model: engine.model ?? "",
          shouldUseGpu: false,
        }),
      );
      expect(Exit.isFailure(exit)).toBe(true);
    }),
  );
});

describe("transcribing when the engine is missing", () => {
  it.live("fails with a plain reason and does not return an empty transcript", () =>
    Effect.gen(function* () {
      const directory = yield* Effect.promise(() => mkdtemp(join(tmpdir(), "outlore-voice-")));
      const wavPath = join(directory, "recording.wav");
      yield* Effect.promise(() => writeFile(wavPath, wav({ dataBytes: 3200 })));
      const exit = yield* Effect.exit(
        transcribeWav(wavPath, {
          binary: join(directory, "no-such-whisper-cli"),
          language: "auto",
          model: join(directory, "no-such-model.bin"),
          shouldUseGpu: false,
        }),
      );
      expect(Exit.isFailure(exit)).toBe(true);
      yield* Effect.promise(() => rm(directory, { force: true, recursive: true }));
    }),
  );
});

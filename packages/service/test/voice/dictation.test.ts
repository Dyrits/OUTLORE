import { existsSync } from "node:fs";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Exit } from "effect";
import { readDictationStatus, transcribeDictation } from "../../src/voice/index.ts";

/** Reads the transcriber's settings from the given variables only, as the environment would give them. */
const withVariables = (variables: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(variables));

/** A 16 kHz, mono, 16-bit WAV file holding `dataBytes` of silence. */
const wavOf = (dataBytes: number): Uint8Array => {
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < 4; index++) view.setUint8(offset + index, value.charCodeAt(index));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, dataBytes, true);
  return bytes;
};
const base64Of = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

/**
 * A folder with a stand-in for whisper.cpp's tool, which prints what it was given to read, and a model file. The
 * stand-in answers the path of the recording, so a test can check the recording is gone afterwards.
 */
const standInEngine = Effect.acquireRelease(
  Effect.promise(async () => {
    const folder = await mkdtemp(join(tmpdir(), "outlore-dictation-"));
    const binary = join(folder, "fake-whisper-cli");
    await writeFile(
      binary,
      '#!/bin/sh\nwhile [ $# -gt 0 ]; do if [ "$1" = "-f" ]; then echo "  heard $2  "; fi; shift; done\n',
    );
    await chmod(binary, 0o755);
    const model = join(folder, "ggml-fake.bin");
    await writeFile(model, "not a real model");
    return { binary, folder, model };
  }),
  (engine) => Effect.promise(() => rm(engine.folder, { force: true, recursive: true })),
);

describe("reading whether dictation can run", () => {
  it.effect("says voice input is not set up when the engine's settings are missing", () =>
    Effect.gen(function* () {
      const status = yield* readDictationStatus.pipe(withVariables({}));
      expect(status.unavailableReason).toContain("OUTLORE_WHISPER_CLI");
    }),
  );

  it.live("names the missing file when the engine or the model is not where the settings say", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const engine = yield* standInEngine;
        const noModel = yield* readDictationStatus.pipe(
          withVariables({ OUTLORE_WHISPER_CLI: engine.binary, OUTLORE_WHISPER_MODEL: join(engine.folder, "gone.bin") }),
        );
        expect(noModel.unavailableReason).toContain("gone.bin");
        const noEngine = yield* readDictationStatus.pipe(
          withVariables({ OUTLORE_WHISPER_CLI: join(engine.folder, "gone-cli"), OUTLORE_WHISPER_MODEL: engine.model }),
        );
        expect(noEngine.unavailableReason).toContain("gone-cli");
      }),
    ),
  );

  it.live("is ready when the engine and the model are both there", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const engine = yield* standInEngine;
        const status = yield* readDictationStatus.pipe(
          withVariables({ OUTLORE_WHISPER_CLI: engine.binary, OUTLORE_WHISPER_MODEL: engine.model }),
        );
        expect(status).toEqual({ unavailableReason: null });
      }),
    ),
  );
});

describe("transcribing a dictation", () => {
  it.live("returns the engine's words, trimmed, and keeps no copy of the recording", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const engine = yield* standInEngine;
        const transcript = yield* transcribeDictation(base64Of(wavOf(3200))).pipe(
          withVariables({ OUTLORE_WHISPER_CLI: engine.binary, OUTLORE_WHISPER_MODEL: engine.model }),
        );
        expect(transcript.text).toMatch(/^heard \S+recording\.wav$/);
        const recording = transcript.text.slice("heard ".length);
        expect(existsSync(recording)).toBe(false);
      }),
    ),
  );

  it.effect("refuses a recording the engine cannot read, as the owner's input, before running anything", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        transcribeDictation(base64Of(new TextEncoder().encode("not audio"))).pipe(
          withVariables({ OUTLORE_WHISPER_CLI: "/no/such/cli", OUTLORE_WHISPER_MODEL: "/no/such/model.bin" }),
        ),
      );
      expect(exit).toEqual(Exit.fail(expect.objectContaining({ kind: "InvalidInput" })));
    }),
  );

  it.effect("fails as a missing dependency when voice input is not set up", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(transcribeDictation(base64Of(wavOf(3200))).pipe(withVariables({})));
      expect(exit).toEqual(Exit.fail(expect.objectContaining({ kind: "MissingDependency" })));
    }),
  );

  it.live("fails as an execution failure when the engine does not finish", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const engine = yield* standInEngine;
        const broken = join(engine.folder, "broken-whisper-cli");
        yield* Effect.promise(async () => {
          await writeFile(broken, "#!/bin/sh\nexit 3\n");
          await chmod(broken, 0o755);
        });
        const exit = yield* Effect.exit(
          transcribeDictation(base64Of(wavOf(3200))).pipe(
            withVariables({ OUTLORE_WHISPER_CLI: broken, OUTLORE_WHISPER_MODEL: engine.model }),
          ),
        );
        expect(exit).toEqual(Exit.fail(expect.objectContaining({ kind: "ExecutionFailure" })));
      }),
    ),
  );
});

// A real transcription through the request's path, only where whisper.cpp's paths are given (as in transcribe.test.ts):
// OUTLORE_WHISPER_CLI, OUTLORE_WHISPER_MODEL, and a 16 kHz mono WAV in OUTLORE_WHISPER_SAMPLE such as samples/jfk.wav.
const engine = {
  binary: process.env.OUTLORE_WHISPER_CLI ?? "",
  model: process.env.OUTLORE_WHISPER_MODEL ?? "",
  sample: process.env.OUTLORE_WHISPER_SAMPLE ?? "",
};

describe.skipIf(engine.binary === "" || engine.model === "" || engine.sample === "")(
  "transcribing a dictation with whisper.cpp",
  () => {
    it.live("returns the words of a known English recording sent as the app sends it", () =>
      Effect.gen(function* () {
        const recording = yield* Effect.promise(() => readFile(engine.sample));
        const transcript = yield* transcribeDictation(recording.toString("base64")).pipe(
          withVariables({
            OUTLORE_WHISPER_CLI: engine.binary,
            OUTLORE_WHISPER_GPU: process.env.OUTLORE_WHISPER_GPU ?? "true",
            OUTLORE_WHISPER_MODEL: engine.model,
          }),
        );
        expect(transcript.text.toLowerCase()).toContain("ask not what your country can do for you");
      }),
    );
  },
);

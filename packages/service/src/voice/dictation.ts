import { constants } from "node:fs";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type DictationStatus, maxDictationBytes, type Transcript } from "@outlore/contracts";
import { Config, Effect } from "effect";
import { invalid, ServiceFailure } from "../core/index.ts";
import { checkWav, readTranscriberSettings, type TranscriberSettings, transcribeWav } from "./transcribe.ts";
import { bundledModelPath, ensureBundledModel } from "./whisperModel.ts";

// The owner's dictation requests (voice-input): whether the host can transcribe now, and one recording turned into
// text. The recording is written to a private temporary folder only for the engine to read, and erased right after,
// whatever the outcome: Outlore keeps no audio (ADR 0024).

const notSetUpReason =
  "Voice input needs the bundled Whisper engine or custom paths in OUTLORE_WHISPER_CLI and OUTLORE_WHISPER_MODEL.";

const readBundledSettings = Effect.gen(function* () {
  const binary = yield* Config.NonEmptyString("OUTLORE_BUNDLED_WHISPER_CLI");
  const dataDirectory = yield* Config.NonEmptyString("OUTLORE_DATA_DIR");
  const language = yield* Config.String("OUTLORE_WHISPER_LANGUAGE").pipe(Config.withDefault("auto"));
  return {
    binary,
    language,
    model: bundledModelPath(dataDirectory),
    shouldUseGpu: false,
  } satisfies TranscriberSettings;
});

const canAccess = (path: string, mode: number) =>
  Effect.promise(() =>
    access(path, mode).then(
      () => true,
      () => false,
    ),
  );

const missingDependency = (message: string) => new ServiceFailure({ kind: "MissingDependency", message });

/** Resolves the manual override or prepares the bundled engine and model before audio is recorded. */
const prepareDictation = Effect.gen(function* () {
  const manual = yield* readTranscriberSettings.pipe(Effect.orElseSucceed(() => null));
  const settings = manual ?? (yield* readBundledSettings.pipe(Effect.orElseSucceed(() => null)));
  if (settings === null) return yield* missingDependency(notSetUpReason);
  if (!(yield* canAccess(settings.binary, constants.X_OK)))
    return yield* missingDependency(`Voice input cannot find whisper.cpp's tool at ${settings.binary}.`);
  if (manual === null) {
    yield* Effect.tryPromise({
      catch: () =>
        new ServiceFailure({
          kind: "ExecutionFailure",
          message:
            "Could not download the voice model. Check your internet connection and available disk space, then try dictation again.",
        }),
      try: () => ensureBundledModel(settings.model),
    });
  }
  if (!(yield* canAccess(settings.model, constants.R_OK)))
    return yield* missingDependency(`Voice input cannot find its model at ${settings.model}.`);
  return settings;
});

/** Whether the host can transcribe a dictation now, with the reason when it cannot. */
export const readDictationStatus = prepareDictation.pipe(
  Effect.match({
    onFailure: (failure): DictationStatus => ({ unavailableReason: failure.message }),
    onSuccess: (): DictationStatus => ({ unavailableReason: null }),
  }),
);

/** A private folder holding the recording for the engine, erased when the transcription ends. */
const temporaryFolder = Effect.acquireRelease(
  Effect.tryPromise({
    catch: () => new ServiceFailure({ kind: "ExecutionFailure", message: "Could not prepare the recording." }),
    try: () => mkdtemp(join(tmpdir(), "outlore-dictation-")),
  }),
  (folder) => Effect.promise(() => rm(folder, { force: true, recursive: true })),
);

/** Transcribes one recording, given as a base64 WAV file, and answers what the engine heard. */
export const transcribeDictation = Effect.fnUntraced(function* (data: string) {
  const bytes = Buffer.from(data, "base64");
  if (bytes.length > maxDictationBytes) return yield* invalid("The recording is longer than dictation allows.");
  // A recording the engine cannot read is the owner's to redo, so it is refused before anything runs.
  yield* checkWav(bytes).pipe(Effect.mapError((failure) => invalid(failure.reason)));
  const settings = yield* prepareDictation;
  const text = yield* Effect.scoped(
    Effect.gen(function* () {
      const folder = yield* temporaryFolder;
      const recording = join(folder, "recording.wav");
      yield* Effect.tryPromise({
        catch: () => new ServiceFailure({ kind: "ExecutionFailure", message: "Could not prepare the recording." }),
        try: () => writeFile(recording, bytes, { mode: 0o600 }),
      });
      return yield* transcribeWav(recording, settings).pipe(
        Effect.mapError((failure) => new ServiceFailure({ kind: "ExecutionFailure", message: failure.reason })),
      );
    }),
  );
  return { text } satisfies Transcript;
});

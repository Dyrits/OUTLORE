import { constants } from "node:fs";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type DictationStatus, maxDictationBytes, type Transcript } from "@outlore/contracts";
import { Effect } from "effect";
import { invalid, ServiceFailure } from "../core/index.ts";
import { checkWav, readTranscriberSettings, type TranscriberSettings, transcribeWav } from "./transcribe.ts";

// The owner's dictation requests (voice-input): whether the host can transcribe now, and one recording turned into
// text. The recording is written to a private temporary folder only for the engine to read, and erased right after,
// whatever the outcome: Outlore keeps no audio (ADR 0024).

/** Why dictation cannot run while the engine's settings are missing; the variables are the only way to set it up yet. */
const notSetUpReason =
  "Voice input is not set up on this computer: set OUTLORE_WHISPER_CLI to whisper.cpp's whisper-cli and OUTLORE_WHISPER_MODEL to a model file such as ggml-base.bin, then restart Outlore.";

/** The engine's settings, or null when the environment does not name the engine and its model. */
const readSettingsOrNull = readTranscriberSettings.pipe(Effect.orElseSucceed(() => null));

/** Why the engine named by the settings cannot run, or null when its tool and model are both there. */
const unavailableReasonOf = (settings: TranscriberSettings) =>
  Effect.promise(async () => {
    const isReachable = (path: string, mode: number) =>
      access(path, mode).then(
        () => true,
        () => false,
      );
    if (!(await isReachable(settings.binary, constants.X_OK)))
      return `Voice input cannot find whisper.cpp's tool at ${settings.binary}.`;
    if (!(await isReachable(settings.model, constants.R_OK)))
      return `Voice input cannot find its model at ${settings.model}.`;
    return null;
  });

/** Whether the host can transcribe a dictation now, with the reason when it cannot. */
export const readDictationStatus: Effect.Effect<DictationStatus> = Effect.gen(function* () {
  const settings = yield* readSettingsOrNull;
  if (settings === null) return { unavailableReason: notSetUpReason };
  return { unavailableReason: yield* unavailableReasonOf(settings) };
});

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
  const settings = yield* readSettingsOrNull;
  if (settings === null) return yield* new ServiceFailure({ kind: "MissingDependency", message: notSetUpReason });
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

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  BackupCompanion,
  LoreHistoryEntry,
  MissionDetail,
  MissionId,
  Request,
  RequestTag,
  ResultOf,
  ThreadId,
} from "@outlore/contracts";
import { Effect, type Layer } from "effect";
import { afterEach } from "vitest";
import { Endpoints, type Harness, type PriceSource } from "../../src/core/index.ts";
import { callThreadTool } from "../../src/harness/fakeHarness.ts";
import { fakeHarnessLayer, type HarnessTools, Service, serviceLayer } from "../../src/index.ts";

/** An isolated service with the scripted fake harness and real temporary SQLite. */
export const fixture = (
  harnessTools?: Layer.Layer<HarnessTools>,
  priceSource?: Layer.Layer<PriceSource>,
  harness: Layer.Layer<Harness> = fakeHarnessLayer("10 millis"),
) => {
  const directory = temporary("outlore-service-");
  return {
    directory,
    layer: serviceLayer({
      filename: join(directory, "store.sqlite"),
      harness,
      ...(harnessTools === undefined ? {} : { harnessTools }),
      ...(priceSource === undefined ? {} : { priceSource }),
      homeFolder: directory,
      scratchRoot: join(directory, "missions"),
    }),
    remove: () => rmSync(directory, { force: true, recursive: true }),
  };
};
const folders: Array<() => void> = [];
/** Registers an isolated service for removal after the current test; the registry behind withService. */
export const register = (value: ReturnType<typeof fixture>) => {
  folders.push(value.remove);
  return value;
};
afterEach(() => {
  for (const remove of folders.splice(0)) remove();
});
/** A fresh temporary folder, removed after the test that asked for it. */
export const temporary = (prefix: string) => {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  folders.push(() => rmSync(directory, { force: true, recursive: true }));
  return directory;
};
/** Runs an effect on a fresh isolated service, whose folder is removed after the test; a harness layer replaces the fake's default. */
export const withService = <A, E, R>(body: Effect.Effect<A, E, R>, harness?: Layer.Layer<Harness>) => {
  const value = fixture(undefined, undefined, harness);
  folders.push(value.remove);
  return body.pipe(Effect.provide(value.layer));
};
/** Calls the owner's service interface. */
export const call = <R extends Request>(request: R) =>
  Effect.gen(function* () {
    return (yield* (yield* Service).handle(request)) as ResultOf<R["_tag"] & RequestTag>;
  });
/** Calls a thread's authenticated MCP interface, as its fake harness does. */
export const tool = (threadId: ThreadId, name: string, args: object) =>
  Effect.gen(function* () {
    return yield* callThreadTool(yield* (yield* Endpoints).urlFor(threadId), name, args);
  });
/** Starts a mission with a unique command identifier. */
export const start = (text = "Hello", workspacePath: string | null = null) =>
  call({
    _tag: "StartMission",
    effort: "default",
    model: "default",
    requestId: crypto.randomUUID(),
    text,
    workspacePath,
  });
/** Starts a mission with chosen fields and a unique command identifier, as harness tests need. */
export const startMission = (fields: Partial<Extract<Request, { _tag: "StartMission" }>> & { text: string }) =>
  call({
    _tag: "StartMission",
    effort: "default",
    model: "default",
    requestId: crypto.randomUUID(),
    workspacePath: null,
    ...fields,
  });
/** Sends an owner message with a unique command identifier. */
export const send = (threadId: ThreadId, text = "Hello") =>
  call({ _tag: "SendMessage", delivery: null, requestId: crypto.randomUUID(), text, threadId });
/** Sends an owner message to a thread, optionally steered into the running turn. */
export const sendTo = (threadId: ThreadId, text: string, delivery: "Steer" | null = null) =>
  call({ _tag: "SendMessage", delivery, requestId: crypto.randomUUID(), text, threadId });
/** Reads a selected thread through the service. */
export const read = (missionId: MissionId, threadId: ThreadId | null = null) =>
  call({ _tag: "ReadMission", missionId, threadId });
/** Waits for observable fake-harness progress without reading service internals. */
export const settle = (
  missionId: MissionId,
  check: (detail: MissionDetail) => boolean,
  threadId: ThreadId | null = null,
) =>
  Effect.gen(function* () {
    for (let i = 0; i < 400; i++) {
      const detail = yield* read(missionId, threadId);
      if (check(detail)) return detail;
      yield* Effect.sleep("10 millis");
    }
    return yield* Effect.die(new Error(`Did not settle: ${JSON.stringify(yield* read(missionId, threadId))}`));
  });
/** Opens a thread by the owner. */
export const open = (parentThreadId: ThreadId, text = "Hello") =>
  call({
    _tag: "OpenThread",
    effort: "default",
    model: "default",
    parentThreadId,
    requestId: crypto.randomUUID(),
    shouldStartAnyway: false,
    text,
  });

/** The entry of the given kind in a lore entry's history; fails the test when there is none. */
export const entryOf = (entries: ReadonlyArray<LoreHistoryEntry>, kind: LoreHistoryEntry["kind"]) => {
  const found = entries.find((entry) => entry.kind === kind);
  if (found === undefined) throw new Error(`no ${kind} entry in ${entries.map((entry) => entry.kind).join(", ")}`);
  return found;
};

/** A codex BackupCompanion as the tests script it. */
export const codexBackup: BackupCompanion = { accountId: null, effort: "default", harness: "codex", model: "gpt-5" };

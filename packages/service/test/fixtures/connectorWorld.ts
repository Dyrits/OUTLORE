import { join } from "node:path";
import type { MissionDetail, Question, Request, ThreadId } from "@outlore/contracts";
import { Deferred, Effect, type Layer } from "effect";
import type { CatalogEntry, ConnectorBackends } from "../../src/connectors/index.ts";
import type { Harness } from "../../src/core/index.ts";
import { fakeHarnessLayer, serviceLayer } from "../../src/index.ts";
import {
  appleLikeEntry,
  appleLikeToolsOf,
  type BackendCall,
  calendarEntry,
  fakeBackendOf,
  fakeBackendsLayer,
  fakeVault,
  scriptedToolsOf,
  testSecret,
  unclassifiedEntry,
} from "./connectorBackend.ts";
import { call, read, settle, temporary } from "./service.ts";

/** What a test of connectors stands on: three fake servers, a fake Vault, a gate that holds slow calls, a service over them. */
export const connectorWorld = (
  options: {
    /** The service's backends, when a test brings its own instead of the fake servers (the HTTP adapter's tests do). */
    readonly backends?: Layer.Layer<ConnectorBackends>;
    /** The whole catalog, when a test brings its own entries; the fake servers' entries by default. */
    readonly entries?: ReadonlyArray<CatalogEntry>;
    readonly harness?: Layer.Layer<Harness>;
    readonly hasKey?: boolean;
    readonly platform?: NodeJS.Platform;
  } = {},
) =>
  Effect.gen(function* () {
    const gate = yield* Deferred.make<void>();
    const received = {
      applefake: [] as Array<BackendCall>,
      calendar: [] as Array<BackendCall>,
      unnamed_service: [] as Array<BackendCall>,
    };
    const calendar = fakeBackendOf(scriptedToolsOf(gate), received.calendar);
    const unnamed = fakeBackendOf(scriptedToolsOf(gate), received.unnamed_service);
    const apple = fakeBackendOf(appleLikeToolsOf(gate), received.applefake);
    const vault = fakeVault();
    if (options.hasKey !== false) {
      vault.put("calendar", "API key", testSecret);
      vault.put("unnamed_service", "API key", testSecret);
    }
    const directory = temporary("outlore-connectors-");
    const catalog = options.entries ?? [calendarEntry, unclassifiedEntry, appleLikeEntry];
    const build = () =>
      serviceLayer({
        connectorBackends:
          options.backends ??
          fakeBackendsLayer({
            applefake: apple.backend,
            calendar: calendar.backend,
            unnamed_service: unnamed.backend,
          }),
        connectorCatalog: catalog,
        connectorPlatform: options.platform ?? "darwin",
        connectorVault: vault.layer,
        filename: join(directory, "store.sqlite"),
        harness: options.harness ?? fakeHarnessLayer("10 millis"),
        homeFolder: directory,
        scratchRoot: join(directory, "missions"),
      });
    return { apple, build, calendar, catalog, directory, gate, layer: build(), received, unnamed, vault };
  });

/** The connector tool names a thread lists, or null when the tool server is not reachable yet. */
export const run = <A, E, R>(world: Effect.Success<ReturnType<typeof connectorWorld>>, body: Effect.Effect<A, E, R>) =>
  body.pipe(Effect.provide(world.layer));

/** Sends one request to the service. */
export const owner = <R extends Request>(request: R) => call(request);

/** Installs a connector, confirming its notice. */
export const install = (connectorId: string, apps?: ReadonlyArray<string>) =>
  call(
    apps === undefined
      ? ({ _tag: "InstallConnector", connectorId, hasConfirmedNotice: true } as const)
      : ({ _tag: "InstallConnector", apps, connectorId, hasConfirmedNotice: true } as const),
  );

/** A thread's turn that has ended or is waiting on the owner. */
export const isIdleOrAsking = (detail: MissionDetail) =>
  detail.thread.state === "Idle" || detail.questions.some((question) => question.outcome === null);

/** The question a thread is waiting on, when it is. */
export const openQuestionOf = (detail: MissionDetail): Question | null =>
  detail.questions.find((question) => question.outcome === null) ?? null;

/** The text of the last agent reply. */
export const replyOf = (detail: MissionDetail) =>
  detail.messages.filter((message) => message.sender === "agent").at(-1)?.text ?? "";

/** Waits for the thread's turn to end. */
export const untilIdle = (missionId: MissionDetail["mission"]["id"], threadId: ThreadId | null = null) =>
  settle(
    missionId,
    (detail) => detail.thread.state === "Idle" && detail.messages.some((message) => message.sender === "agent"),
    threadId,
  );

/** Waits for the thread to ask the owner a question, and returns it. */
export const untilAsked = (missionId: MissionDetail["mission"]["id"], threadId: ThreadId | null = null) =>
  settle(missionId, (detail) => openQuestionOf(detail) !== null, threadId);

export { read, settle };

/** Runs a test body on a service over the connector world, handing the body the world. */
export const inWorld = <A, E, R>(
  options: Parameters<typeof connectorWorld>[0],
  body: (world: Effect.Success<ReturnType<typeof connectorWorld>>) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const world = yield* connectorWorld(options);
    return yield* body(world).pipe(Effect.provide(world.layer));
  });

/** Waits until the thread has this many agent replies and is idle: its turns have ended. */
export const untilReplies = (
  missionId: MissionDetail["mission"]["id"],
  count: number,
  threadId: ThreadId | null = null,
) =>
  settle(
    missionId,
    (detail) =>
      detail.thread.state === "Idle" && detail.messages.filter((message) => message.sender === "agent").length >= count,
    threadId,
  );

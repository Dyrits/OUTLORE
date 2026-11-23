import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { UpdaterStatus } from "@outlore/contracts";
import { createPairedHosts, type KeyValueStorage, type OpenTransport } from "@outlore/controller";
import { openBrowserTransport, pairFromBrowser } from "@outlore/controller/browser";
import { startNodeRelay } from "@outlore/relay";
import { Effect, Exit, Layer, Ref, Scope } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { fakeHarnessLayer, Service, serveLoopback, serviceLayer } from "../../src/index.ts";
import { HostUpdater } from "../../src/update/index.ts";

// A device that was updated reaches the host it is paired with, which still runs the earlier release: it asks the host to
// update over a link that tolerates the other release, the host installs, restarts, and the same pairing resumes
// (app-updates, Updating a host from a paired device). Whole services over real databases and a real local relay.

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const until = <A>(check: () => A | undefined | Promise<A | undefined>) =>
  Effect.gen(function* () {
    for (let index = 0; index < 400; index++) {
      const value = yield* Effect.promise(async () => check());
      if (value !== undefined) return value;
      yield* Effect.sleep("20 millis");
    }
    return yield* Effect.fail(new Error("timed out waiting"));
  });

const memoryStorage = (): KeyValueStorage => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
};

const earlier = "0.1.9-Prototype";
const later = "0.1.10-Prototype";

/** The desktop app's updater as the host's service sees it: the host asks, the test says what happened. */
const fakeDesktopUpdater = () => {
  const status = Ref.makeUnsafe<UpdaterStatus>({ _tag: "Idle", note: null });
  const calls = { checks: 0, installs: 0 };
  const layer = Layer.succeed(HostUpdater, {
    check: Effect.gen(function* () {
      calls.checks++;
      const ready = { _tag: "Ready", version: later } as const;
      yield* Ref.set(status, ready);
      return ready;
    }),
    install: Effect.sync(() => {
      calls.installs++;
      return { failure: null };
    }),
    state: Ref.get(status),
  });
  return { calls, layer };
};

/** A text link as the app's client holds it, sending requests and keeping what came back. */
const driven = (openTransport: OpenTransport) => {
  const state = {
    closed: null as { code: number; reason: string } | null,
    frames: [] as { _tag: string; id?: string; error?: { kind: string }; value?: unknown }[],
  };
  const transport = openTransport({
    onClose: (code, reason) => {
      state.closed = { code, reason };
    },
    onError: () => {},
    onOpen: () => {},
    onText: (data) => state.frames.push(JSON.parse(String(data))),
  });
  let next = 0;
  return {
    ask: (request: object) =>
      Effect.gen(function* () {
        const id = String(++next);
        transport.send(JSON.stringify({ id, request }));
        return yield* until(() => state.frames.find((frame) => frame.id === id));
      }),
    close: () => transport.close(),
    get closed() {
      return state.closed;
    },
  };
};

/** A host's service while it runs. */
interface RunningHost {
  readonly connected: Effect.Effect<unknown, Error>;
  readonly run: (request: object) => Effect.Effect<unknown, unknown>;
  /** Leaves a turn recorded as running, as a harness would while it works. */
  readonly startRunningTurn: Effect.Effect<void, unknown>;
  readonly stop: Effect.Effect<void>;
}

const makeWorld = Effect.gen(function* () {
  const relay = yield* startNodeRelay();
  const relayOrigin = `http://127.0.0.1:${relay.port}`;
  const hostDirectory = mkdtempSync(join(tmpdir(), "outlore-host-update-"));
  directories.push(hostDirectory);

  /** The host's service over its one database; stopping it and starting another is the app restarting. */
  const startHost = (release: string, hostUpdater: Layer.Layer<HostUpdater>) =>
    Effect.gen(function* () {
      const scope = yield* Scope.make();
      const context = yield* Layer.build(
        serviceLayer({
          computerName: "Host Mac",
          filename: join(hostDirectory, "outlore.sqlite"),
          harness: fakeHarnessLayer("10 millis"),
          homeFolder: hostDirectory,
          hostUpdater,
          relayOrigin,
          release,
          scratchRoot: join(hostDirectory, "missions"),
        }),
      ).pipe(Scope.provide(scope));
      const run = (request: object) =>
        Effect.gen(function* () {
          return yield* (yield* Service).handle(request as never);
        }).pipe(Effect.provideContext(context));
      const startRunningTurn = Effect.gen(function* () {
        const quest = (yield* (yield* Service).handle({
          _tag: "StartEmptyQuest",
          realmId: null,
          requestId: "quest-running",
        })) as { threadId: string };
        const sql = yield* SqlClient.SqlClient;
        yield* sql`INSERT INTO turns (id, thread_id, status, started_at) VALUES ('turn-running', ${quest.threadId}, 'running', 1)`;
      }).pipe(Effect.provideContext(context));
      const connected = until(() =>
        Effect.runPromise(run({ _tag: "ReadRemoteAccess" })).then((view) =>
          (view as { status: string }).status === "Connected" ? view : undefined,
        ),
      );
      return { connected, run, startRunningTurn, stop: Scope.close(scope, Exit.void) } satisfies RunningHost;
    });

  const pairedHost = (host: RunningHost) =>
    Effect.gen(function* () {
      // The runtime hears the switch only once it has read its settings and gone to wait.
      yield* until(() =>
        Effect.runPromise(host.run({ _tag: "ReadRemoteAccess" })).then((view) =>
          (view as { status: string }).status === "Off" ? view : undefined,
        ),
      );
      yield* Effect.sleep("150 millis");
      yield* host.run({ _tag: "SetRemoteAccess", isEnabled: true });
      yield* host.connected;
      return ((yield* host.run({ _tag: "CreatePairingCode" })) as { code: string }).code;
    });

  return { hostDirectory, pairedHost, relayOrigin, startHost };
});

const pageOf = (release: string) => ({ allowLocalRelay: true, kind: "browser", release }) as const;

describe("updating a host from a device of a later release", () => {
  it.live("the host updates on the device's word, installs once, and the same pairing resumes after its restart", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld;
        const updater = fakeDesktopUpdater();
        const firstHost = yield* world.startHost(earlier, updater.layer);
        const code = yield* world.pairedHost(firstHost);

        // The device pairs while both run the earlier release, then the device is updated.
        const storage = memoryStorage();
        const hosts = createPairedHosts(storage);
        const host = yield* Effect.promise(() => pairFromBrowser(code, "Pixel", hosts, pageOf(earlier)));
        const laterPage = pageOf(later);

        // The plain link ends with the release mismatch, as before.
        const plain = driven(openBrowserTransport(hosts, host.id, laterPage));
        yield* until(() => plain.closed ?? undefined);
        expect(plain.closed).toMatchObject({ code: 4003 });

        // The update link keeps the host of another release, and reads where its update stands.
        const updating = driven(openBrowserTransport(hosts, host.id, laterPage, { acceptOtherRelease: true }));
        expect(yield* updating.ask({ _tag: "ReadHostUpdate" })).toMatchObject({
          _tag: "Success",
          value: { release: earlier, status: { _tag: "Idle" } },
        });
        expect(yield* updating.ask({ _tag: "UpdateHost" })).toMatchObject({ _tag: "Success" });
        // The device goes away at once: the install is the host's decision now.
        updating.close();
        yield* until(() => (updater.calls.installs === 1 ? true : undefined));
        yield* Effect.sleep("300 millis");
        expect(updater.calls.installs).toBe(1);

        // The host quits for the install and comes back on the later release over the same database.
        yield* firstHost.stop;
        const secondHost = yield* world.startHost(later, fakeDesktopUpdater().layer);
        yield* secondHost.connected;

        // Nothing is paired again: the device's stored token resumes, and the release now matches.
        const resumed = driven(openBrowserTransport(hosts, host.id, laterPage));
        expect(yield* resumed.ask({ _tag: "ReadHostName" })).toMatchObject({ _tag: "Success", value: "Host Mac" });
        expect(yield* resumed.ask({ _tag: "ReadHostUpdate" })).toMatchObject({
          value: { release: later },
        });
        expect(resumed.closed).toBeNull();
        expect(yield* secondHost.run({ _tag: "ReadRemoteAccess" })).toMatchObject({
          devices: [{ kind: "browser", name: "Pixel" }],
        });
        resumed.close();
        yield* secondHost.stop;
      }),
    ),
  );

  it.live("a device forces the update over a running turn, and a plain ask still waits", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld;
        const updater = fakeDesktopUpdater();
        const host = yield* world.startHost(earlier, updater.layer);
        const code = yield* world.pairedHost(host);
        const hosts = createPairedHosts(memoryStorage());
        const paired = yield* Effect.promise(() => pairFromBrowser(code, "Pixel", hosts, pageOf(earlier)));
        yield* host.startRunningTurn;
        const updating = driven(openBrowserTransport(hosts, paired.id, pageOf(later), { acceptOtherRelease: true }));
        expect(yield* updating.ask({ _tag: "UpdateHost" })).toMatchObject({ _tag: "Success" });
        yield* until(() =>
          updating.ask({ _tag: "ReadHostUpdate" }).pipe(
            Effect.map((frame) => {
              const status = (frame.value as { status: { _tag: string } } | undefined)?.status;
              return status?._tag === "WaitingForTurns" ? true : undefined;
            }),
          ),
        );
        expect(updater.calls.installs).toBe(0);
        expect(yield* updating.ask({ _tag: "ForceUpdateHost" })).toMatchObject({
          _tag: "Success",
          value: { status: { _tag: "Installing" } },
        });
        yield* until(() => (updater.calls.installs === 1 ? true : undefined));
        updating.close();
        yield* host.stop;
      }),
    ),
  );

  it.live("a host that does not know the force request answers with a failure the device can read", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld;
        const host = yield* world.startHost(earlier, fakeDesktopUpdater().layer);
        const code = yield* world.pairedHost(host);
        const hosts = createPairedHosts(memoryStorage());
        const paired = yield* Effect.promise(() => pairFromBrowser(code, "Pixel", hosts, pageOf(earlier)));
        const open = openBrowserTransport(hosts, paired.id, pageOf(later), { acceptOtherRelease: true });
        // A host from before this feature decodes no ForceUpdateHost; a tag this host does not know stands in for it.
        const link = driven((handlers) => {
          const transport = open(handlers);
          return {
            close: () => transport.close(),
            get isOpen() {
              return transport.isOpen;
            },
            send: (text) => transport.send(text.replace("ForceUpdateHost", "ForceUpdateHostOfAnEarlierRelease")),
          };
        });
        expect(yield* link.ask({ _tag: "ForceUpdateHost" })).toMatchObject({
          _tag: "Failure",
          error: { kind: "InvalidInput" },
        });
        link.close();
        yield* host.stop;
      }),
    ),
  );

  it.live("a host that does not know the request answers with a failure the device reads as too old", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld;
        const host = yield* world.startHost(earlier, fakeDesktopUpdater().layer);
        const code = yield* world.pairedHost(host);
        const hosts = createPairedHosts(memoryStorage());
        const paired = yield* Effect.promise(() => pairFromBrowser(code, "Pixel", hosts, pageOf(earlier)));
        // An older host decodes none of the new request tags; a tag this host does not know stands in for them.
        const asUnknown =
          (open: OpenTransport): OpenTransport =>
          (handlers) => {
            const transport = open(handlers);
            return {
              close: () => transport.close(),
              get isOpen() {
                return transport.isOpen;
              },
              send: (text) => transport.send(text.replace("ReadHostUpdate", "ReadHostUpdateOfAnEarlierRelease")),
            };
          };
        const link = driven(
          asUnknown(openBrowserTransport(hosts, paired.id, pageOf(later), { acceptOtherRelease: true })),
        );
        expect(yield* link.ask({ _tag: "ReadHostUpdate" })).toMatchObject({
          _tag: "Failure",
          error: { kind: "InvalidInput" },
        });
        link.close();
        yield* host.stop;
      }),
    ),
  );

  it.live("a desktop device reaches the host through its own service on the update path only", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld;
        const updater = fakeDesktopUpdater();
        const host = yield* world.startHost(earlier, updater.layer);
        const code = yield* world.pairedHost(host);

        const controllerDirectory = mkdtempSync(join(tmpdir(), "outlore-desktop-device-"));
        directories.push(controllerDirectory);
        const startController = (release: string) =>
          Effect.gen(function* () {
            const scope = yield* Scope.make();
            const context = yield* Layer.build(
              serviceLayer({
                computerName: "Laptop",
                filename: join(controllerDirectory, "outlore.sqlite"),
                harness: fakeHarnessLayer("10 millis"),
                homeFolder: controllerDirectory,
                relayOrigin: world.relayOrigin,
                release,
                scratchRoot: join(controllerDirectory, "missions"),
              }),
            ).pipe(Scope.provide(scope));
            const { port } = yield* serveLoopback({ port: 0, token: "owner-token" }).pipe(
              Effect.provideContext(context),
              Scope.provide(scope),
            );
            const run = (request: object) =>
              Effect.gen(function* () {
                return yield* (yield* Service).handle(request as never);
              }).pipe(Effect.provideContext(context));
            return { port, run, stop: Scope.close(scope, Exit.void) };
          });

        const laptop = yield* startController(earlier);
        const paired = (yield* laptop.run({ _tag: "AddHost", code, deviceName: "Laptop" })) as { id: string };
        yield* laptop.stop;
        // The laptop's app is updated and restarts on the later release.
        const updated = yield* startController(later);
        const socketTo = (path: string) =>
          driven((handlers) => {
            const socket = new WebSocket(`ws://127.0.0.1:${updated.port}${path}?token=owner-token`);
            const waiting: string[] = [];
            socket.addEventListener("open", () => {
              handlers.onOpen();
              for (const text of waiting.splice(0)) socket.send(text);
            });
            socket.addEventListener("message", (event) => handlers.onText(event.data));
            socket.addEventListener("close", (event) => handlers.onClose(event.code, event.reason));
            return {
              close: () => socket.close(),
              get isOpen() {
                return socket.readyState === WebSocket.OPEN;
              },
              send: (text) => {
                if (socket.readyState === WebSocket.OPEN) socket.send(text);
                else waiting.push(text);
              },
            };
          });

        const plain = socketTo(`/host/${paired.id}`);
        yield* until(() => plain.closed ?? undefined);
        expect(plain.closed).toMatchObject({ code: 4003 });

        const link = socketTo(`/host/${paired.id}/update`);
        expect(yield* link.ask({ _tag: "ReadHostUpdate" })).toMatchObject({
          value: { release: earlier },
        });
        expect(yield* link.ask({ _tag: "UpdateHost" })).toMatchObject({ _tag: "Success" });
        yield* until(() => (updater.calls.installs === 1 ? true : undefined));
        link.close();

        yield* host.stop;
        const restarted = yield* world.startHost(later, fakeDesktopUpdater().layer);
        yield* restarted.connected;
        const resumed = socketTo(`/host/${paired.id}`);
        expect(yield* resumed.ask({ _tag: "ReadHostName" })).toMatchObject({ _tag: "Success", value: "Host Mac" });
        expect(resumed.closed).toBeNull();
        resumed.close();
        yield* restarted.stop;
        yield* updated.stop;
      }),
    ),
  );
});

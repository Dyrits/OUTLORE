import { describe, expect, it } from "@effect/vitest";
import { type PairedHostStore, resumeHost } from "@outlore/controller";
import type { HostConnection } from "@outlore/relay";
import { Effect, Fiber } from "effect";
import { SqlClient } from "effect/sql";
import { readHostLink } from "../../src/remote/knownHosts.ts";

// Two whole services, each over its own database, joined by a real local relay: the host accepts paired devices and
// the controller pairs with it and steers it through its own loopback socket (device-pairing).

import { makeWorld, until } from "./fixtures/pairingWorld.ts";

describe("holding a controller host link", () => {
  it.live("refuses a desktop pairing of another release before saving it", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld({ controllerRelease: "another-release" });
        yield* world.allowPairing;
        const failure = yield* Effect.flip(world.pair(yield* world.newCode()));
        expect(failure).toMatchObject({ message: expect.stringContaining("another-release") });
        expect(yield* world.controllerSql((sql) => sql`SELECT id FROM remote_hosts`)).toEqual([]);
      }),
    ),
  );

  it.live("reports closure that arrives during a delayed pairing-store update", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        yield* world.allowPairing;
        const host = yield* world.pair(yield* world.newCode());
        const record = yield* world.controllerSql((sql) =>
          readHostLink(host.id).pipe(Effect.provideService(SqlClient.SqlClient, sql)),
        );
        let release: () => void = () => {};
        let entered: () => void = () => {};
        const ready = new Promise<void>((resolve) => {
          entered = resolve;
        });
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        const store: PairedHostStore = {
          link: async () => record,
          save: async () => {
            throw new Error("not used");
          },
          touch: async () => {
            entered();
            await held;
          },
        };
        const opening = Effect.runPromise(
          resumeHost(store, host.id, { allowLocalRelay: true, kind: "desktop", release: "development" }),
        );
        yield* Effect.promise(() => ready);
        yield* world.host({ _tag: "SetRemoteAccess", isEnabled: false });
        yield* Effect.sleep("100 millis");
        release();
        const link = yield* Effect.promise(() => opening);
        let isClosed = false;
        link.channel.onClose(() => {
          isClosed = true;
        });
        expect(isClosed).toBe(true);
      }),
    ),
  );

  it.live("rejects an old relay connection after access is switched off and back on", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        const presence = yield* world.presence;
        yield* world.allowPairing;
        const generation = presence.generation();
        yield* world.host({ _tag: "SetRemoteAccess", isEnabled: false });
        expect(yield* presence.status).toBe("Off");
        expect(
          yield* world.hostSql((sql) =>
            presence.admitDevice("absent", () => {}).pipe(Effect.provideService(SqlClient.SqlClient, sql)),
          ),
        ).toBeNull();
        yield* world.allowPairing;
        let isClosed = false;
        const stale: HostConnection = {
          close: () => {
            isClosed = true;
          },
          closeClient: () => {},
          onClientData: () => {},
          onClientJoined: () => {},
          onClientLeft: () => {},
          onClose: () => {},
          sendToClient: () => {},
          usesLegacyClaim: false,
        };
        expect(presence.attachRelay(stale, generation)).toBe(false);
        expect(isClosed).toBe(true);
      }),
    ),
  );

  it.live("buffers while storage is delayed and closes when storage fails", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        yield* world.allowPairing;
        const host = yield* world.pair(yield* world.newCode());
        const record = yield* world.controllerSql((sql) =>
          readHostLink(host.id).pipe(Effect.provideService(SqlClient.SqlClient, sql)),
        );
        let release: () => void = () => {};
        let entered: () => void = () => {};
        const ready = new Promise<void>((resolve) => {
          entered = resolve;
        });
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        const store: PairedHostStore = {
          link: async () => record,
          save: async () => {
            throw new Error("not used");
          },
          touch: async () => {
            entered();
            await held;
          },
        };
        const opening = Effect.runPromise(
          resumeHost(store, host.id, { allowLocalRelay: true, kind: "desktop", release: "development" }),
        );
        yield* Effect.promise(() => ready);
        yield* Effect.sleep("100 millis");
        release();
        const link = yield* Effect.promise(() => opening);
        const frames: string[] = [];
        link.listen((text) => frames.push(text));
        expect(frames.some((text) => JSON.parse(text)._tag === "Changed")).toBe(true);
        link.channel.close();
        // A fiber interrupted while the pairing store updates closes the channel it had opened.
        let isTouching: () => void = () => {};
        const touching = new Promise<void>((resolve) => {
          isTouching = resolve;
        });
        const canceled = Effect.runFork(
          resumeHost(
            {
              ...store,
              touch: () => {
                isTouching();
                return new Promise<void>(() => {});
              },
            },
            host.id,
            { allowLocalRelay: true, kind: "desktop", release: "development" },
          ),
        );
        yield* Effect.promise(() => touching);
        yield* Fiber.interrupt(canceled);
        const failed = Effect.runPromise(
          resumeHost(
            {
              ...store,
              touch: async () => {
                throw new Error("store failed");
              },
            },
            host.id,
            { allowLocalRelay: true, kind: "desktop", release: "development" },
          ),
        );
        yield* Effect.promise(() => expect(failed).rejects.toThrow("store failed"));
        yield* until(() =>
          Effect.runPromise(world.accessOf()).then((view) =>
            view.devices.every((device) => !device.isConnected) ? true : undefined,
          ),
        );
      }),
    ),
  );

  it.live("keeps the host announcement until the bridge starts listening", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        yield* world.allowPairing;
        const host = yield* world.pair(yield* world.newCode());
        const channel = yield* world.open(host.id);
        yield* Effect.sleep("100 millis");
        const frames: string[] = [];
        channel.onText((text) => frames.push(text));
        expect(frames.some((text) => JSON.parse(text)._tag === "Changed")).toBe(true);
        channel.close();
      }),
    ),
  );
});

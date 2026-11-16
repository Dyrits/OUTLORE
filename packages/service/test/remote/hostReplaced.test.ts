import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { closingFrame } from "@outlore/relay";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { WebSocketServer } from "ws";
import { fakeHarnessLayer, Service, serviceLayer } from "../../src/index.ts";
import { HostPresence } from "../../src/remote/index.ts";

// How the host keeps its connection to the relay over time, on the test clock: it backs off when the relay cannot be
// reached, waits the long retry when another host replaced it (device-pairing, SP-H-04), and starts over at once when
// the owner changes the settings.

const turn = Effect.promise(() => new Promise<void>((resolve) => setImmediate(resolve)));
const settle = Effect.gen(function* () {
  for (let index = 0; index < 20; index++) yield* turn;
});

/** A relay that counts the hosts that connect and answers each as `answer` says: refuse the upgrade, or replace it. */
const stubRelay = (answer: "refuse" | "replace") =>
  Effect.acquireRelease(
    Effect.promise(async () => {
      const attempts = { count: 0 };
      const sockets = new WebSocketServer({ noServer: true });
      const server = createServer();
      server.on("upgrade", (request, socket, head) => {
        attempts.count += 1;
        socket.on("error", () => null);
        if (answer === "refuse") {
          socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
          return;
        }
        sockets.handleUpgrade(request, socket, head, (opened) => {
          opened.on("error", () => null);
          opened.send(closingFrame(1012, "replaced"));
        });
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      return { attempts, origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`, server, sockets };
    }),
    ({ server, sockets }) =>
      Effect.promise(async () => {
        for (const client of sockets.clients) client.terminate();
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }),
  );

/** A host service pointed at `relayOrigin`, with the owner's access switch under its own control. */
const hostAt = (relayOrigin: string) =>
  Effect.gen(function* () {
    const directory = mkdtempSync(join(tmpdir(), "outlore-reconnect-"));
    yield* Effect.addFinalizer(() => Effect.sync(() => rmSync(directory, { force: true, recursive: true })));
    const context = yield* Layer.build(
      serviceLayer({
        computerName: "Host Mac",
        filename: join(directory, "outlore.sqlite"),
        harness: fakeHarnessLayer("10 millis"),
        homeFolder: directory,
        relayOrigin,
        release: "development",
        scratchRoot: join(directory, "missions"),
      }),
    );
    const setAccess = (isEnabled: boolean) =>
      Effect.gen(function* () {
        const service = yield* Service;
        return yield* service.handle({ _tag: "SetRemoteAccess", isEnabled });
      }).pipe(Effect.provideContext(context));
    const presence = yield* HostPresence.pipe(Effect.provideContext(context));
    return { presence, setAccess };
  });

describe("a host that another host replaced", () => {
  it.effect("waits the long retry before it connects again, and reports itself unreachable", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const relay = yield* stubRelay("replace");
        const host = yield* hostAt(relay.origin);
        yield* host.setAccess(true);
        while (relay.attempts.count < 1) yield* turn;
        yield* settle;
        expect(yield* host.presence.status).toBe("Unreachable");
        yield* TestClock.adjust(29_999);
        yield* settle;
        expect(relay.attempts.count).toBe(1);
        yield* TestClock.adjust(1);
        while (relay.attempts.count < 2) yield* turn;
        expect(relay.attempts.count).toBe(2);
      }),
    ),
  );
});

describe("a host that cannot reach its relay", () => {
  it.effect("tries again after 1, 2 and 4 seconds, doubling up to 30", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const relay = yield* stubRelay("refuse");
        const host = yield* hostAt(relay.origin);
        yield* host.setAccess(true);
        let attempts = 1;
        for (const wait of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]) {
          while (relay.attempts.count < attempts) yield* turn;
          yield* settle;
          expect(yield* host.presence.status).toBe("Unreachable");
          yield* TestClock.adjust(wait - 1);
          yield* settle;
          expect(relay.attempts.count, `before ${wait} ms`).toBe(attempts);
          yield* TestClock.adjust(1);
          attempts += 1;
        }
        while (relay.attempts.count < attempts) yield* turn;
        expect(relay.attempts.count).toBe(8);
      }),
    ),
  );

  it.effect("starts over at once when the owner changes the settings", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const relay = yield* stubRelay("refuse");
        const host = yield* hostAt(relay.origin);
        yield* host.setAccess(true);
        while (relay.attempts.count < 1) yield* turn;
        yield* TestClock.adjust(1_000);
        while (relay.attempts.count < 2) yield* turn;
        yield* settle;
        yield* host.setAccess(false);
        yield* settle;
        expect(yield* host.presence.status).toBe("Off");
        const before = relay.attempts.count;
        yield* host.setAccess(true);
        while (relay.attempts.count <= before) yield* turn;
        expect(relay.attempts.count).toBe(before + 1);
      }),
    ),
  );
});

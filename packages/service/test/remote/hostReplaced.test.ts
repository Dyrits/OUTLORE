import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { closingFrame, legacyClaimUntil } from "@outlore/relay";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { WebSocketServer } from "ws";
import { fakeHarnessLayer, Service, serviceLayer } from "../../src/index.ts";
import { HostPresence } from "../../src/remote/presence.ts";

// How the host keeps its connection to the relay over time, on the test clock: it backs off when the relay cannot be
// reached, waits the long retry when another host replaced it (device-pairing, SP-H-04), starts over at once when
// the owner changes the settings, and starts the backoff over after a connection that held for 30 seconds.

const turn = Effect.promise(() => new Promise<void>((resolve) => setImmediate(resolve)));
const settle = Effect.gen(function* () {
  for (let index = 0; index < 20; index++) yield* turn;
});

type Answer = "busy" | "earlier" | "hold" | "limit" | "refuse" | "replace";

/**
 * A relay that counts the hosts that connect and answers each as `answer` says: refuse the upgrade, replace it, or
 * hold it open until the test drops it. `answer.current` may be changed between attempts.
 */
const stubRelay = (first: Answer) =>
  Effect.acquireRelease(
    Effect.promise(async () => {
      const attempts = { count: 0, legacy: 0 };
      const answer = { current: first };
      const sockets = new WebSocketServer({ noServer: true });
      const server = createServer();
      server.on("upgrade", (request, socket, head) => {
        // A pass of the host is one attempt; the second try of a pass, with the claim in the address for a relay of an
        // earlier release (until `legacyClaimUntil`), carries no subprotocol and is not counted.
        const isLegacyTry = request.headers["sec-websocket-protocol"] === void 0;
        if (isLegacyTry) attempts.legacy += 1;
        else attempts.count += 1;
        socket.on("error", () => null);
        if (answer.current === "busy") {
          socket.end(
            "HTTP/1.1 429 Too Many Requests\r\nRetry-After: 60\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
          );
          return;
        }
        // A relay of an earlier release knows only the claim in the address, and turns a subprotocol away.
        if (answer.current === "refuse" || (answer.current === "earlier" && !isLegacyTry)) {
          socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
          return;
        }
        sockets.handleUpgrade(request, socket, head, (opened) => {
          opened.on("error", () => null);
          if (answer.current === "replace") opened.send(closingFrame(1012, "replaced"));
          if (answer.current === "limit") opened.send(closingFrame(4029, "rate limited"));
        });
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      return {
        answer,
        attempts,
        /** Ends every connection the relay holds, as a relay that dropped them. */
        dropAll: () => {
          for (const client of sockets.clients) client.terminate();
        },
        origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
        server,
        sockets,
      };
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

describe("a host that the relay turned away as rate limited", () => {
  it.effect("waits the long retry, so its own retries cannot feed the limit that refused it", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const relay = yield* stubRelay("limit");
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
        yield* settle;
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

describe("a host whose connection ended after it had held", () => {
  /** Three refusals, then a held connection: the next wait would be 8 s. `heldMillis` is how long it stays up. */
  const dropAfter = (heldMillis: number) =>
    Effect.gen(function* () {
      const relay = yield* stubRelay("refuse");
      const host = yield* hostAt(relay.origin);
      yield* host.setAccess(true);
      let attempts = 1;
      for (const wait of [1_000, 2_000, 4_000]) {
        while (relay.attempts.count < attempts) yield* turn;
        yield* settle;
        yield* TestClock.adjust(wait);
        attempts += 1;
      }
      relay.answer.current = "hold";
      while (relay.attempts.count < attempts) yield* turn;
      while ((yield* host.presence.status) !== "Connected") yield* turn;
      yield* TestClock.adjust(heldMillis);
      relay.dropAll();
      while ((yield* host.presence.status) === "Connected") yield* turn;
      yield* settle;
      return { attempts, relay };
    });

  it.effect("starts the backoff over when the connection held for 30 seconds: the next try is 1 second away", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const { attempts, relay } = yield* dropAfter(30_000);
        yield* TestClock.adjust(999);
        yield* settle;
        expect(relay.attempts.count).toBe(attempts);
        yield* TestClock.adjust(1);
        while (relay.attempts.count < attempts + 1) yield* turn;
        expect(relay.attempts.count).toBe(attempts + 1);
      }),
    ),
  );

  it.effect(
    "goes on with the backoff when the connection held less than 30 seconds: the next try is 8 seconds away",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const { attempts, relay } = yield* dropAfter(29_999);
          yield* TestClock.adjust(7_999);
          yield* settle;
          expect(relay.attempts.count).toBe(attempts);
          yield* TestClock.adjust(1);
          while (relay.attempts.count < attempts + 1) yield* turn;
          expect(relay.attempts.count).toBe(attempts + 1);
        }),
      ),
  );
});

describe("a host and a relay of an earlier release, while the claim may still go in the address", () => {
  it.effect(
    "tries the address form only after two attempts in a row were turned away, and then reaches the relay",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const relay = yield* stubRelay("earlier");
          const host = yield* hostAt(relay.origin);
          yield* host.setAccess(true);
          while (relay.attempts.count < 1) yield* turn;
          yield* settle;
          expect(relay.attempts).toEqual({ count: 1, legacy: 0 });
          yield* TestClock.adjust(1_000);
          while (relay.attempts.count < 2) yield* turn;
          yield* settle;
          expect(relay.attempts).toEqual({ count: 2, legacy: 0 });
          yield* TestClock.adjust(2_000);
          while ((yield* host.presence.status) !== "Connected") yield* turn;
          expect(relay.attempts).toEqual({ count: 3, legacy: 1 });
        }),
      ),
  );

  it.effect("does not send its claim in the address after the transition ended: the relay stays unreachable", () =>
    Effect.scoped(
      Effect.gen(function* () {
        yield* TestClock.setTime(legacyClaimUntil);
        const relay = yield* stubRelay("earlier");
        const host = yield* hostAt(relay.origin);
        yield* host.setAccess(true);
        for (const wait of [1_000, 2_000, 4_000]) {
          yield* settle;
          yield* TestClock.adjust(wait);
        }
        while (relay.attempts.count < 4) yield* turn;
        expect(yield* host.presence.status).not.toBe("Connected");
        expect(relay.attempts.legacy).toBe(0);
      }),
    ),
  );
});

describe("a host and a relay of this release that fails", () => {
  /** The relay turns the first try away as `answer`, then works; the claim must never go in the address. */
  const failsOnce = (answer: "busy" | "refuse") =>
    Effect.scoped(
      Effect.gen(function* () {
        const relay = yield* stubRelay(answer);
        const host = yield* hostAt(relay.origin);
        yield* host.setAccess(true);
        while (relay.attempts.count < 1) yield* turn;
        yield* settle;
        relay.answer.current = "hold";
        yield* TestClock.adjust(1_000);
        while ((yield* host.presence.status) !== "Connected") yield* turn;
        expect(relay.attempts).toEqual({ count: 2, legacy: 0 });
      }),
    );

  it.effect("does not put the claim in the address after a blip (a refused upgrade)", () => failsOnce("refuse"));

  it.effect("does not put the claim in the address after a 429", () => failsOnce("busy"));

  it.effect("never does once the relay has taken the claim in a subprotocol, whatever it does later", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const relay = yield* stubRelay("hold");
        const host = yield* hostAt(relay.origin);
        yield* host.setAccess(true);
        while ((yield* host.presence.status) !== "Connected") yield* turn;
        // It now behaves like a relay of an earlier release, and drops the host.
        relay.answer.current = "earlier";
        relay.dropAll();
        while ((yield* host.presence.status) === "Connected") yield* turn;
        for (const wait of [1_000, 2_000, 4_000, 8_000]) {
          yield* settle;
          yield* TestClock.adjust(wait);
        }
        while (relay.attempts.count < 5) yield* turn;
        yield* settle;
        expect(relay.attempts.legacy).toBe(0);
      }),
    ),
  );
});

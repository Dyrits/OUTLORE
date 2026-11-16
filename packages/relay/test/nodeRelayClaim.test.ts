import { it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect } from "vitest";
import { startNodeRelay } from "../src/index.ts";
import { claimProtocolOf, legacyClaimUntil, relayProtocol } from "../src/route.ts";
import { clientPath, connect, hostPath, open, room } from "./fixtures/wsClient.ts";

// The host's claim travels in the WebSocket subprotocol, not in the address (SP-H-09). The address form is still
// taken until `legacyClaimUntil` so that hosts and relays of earlier releases keep working, and not after it.

const claim = Buffer.from("a-sixteen-plus-byte-secret");
const other = Buffer.from("another-sixteen-plus-byte-secret");
const offered = (bytes: Uint8Array) => [relayProtocol, claimProtocolOf(bytes)];
const hostOnly = `/r/${room}?role=host`;

describe("a host that sends its claim in the subprotocol", () => {
  it.effect("is accepted with the relay's own subprotocol, and the address carried no claim", () =>
    Effect.gen(function* () {
      const relay = yield* startNodeRelay();
      const host = yield* Effect.promise(() => connect(relay.port, hostOnly, offered(claim)));
      expect(host.socket.protocol).toBe(relayProtocol);
      host.socket.send("ping");
      expect((yield* Effect.promise(() => host.messagesAfter(1)))[0]?.data.toString()).toBe("pong");
    }),
  );

  it.effect("keeps the room for the first claim, so another claim is refused as a mismatch", () =>
    Effect.gen(function* () {
      const relay = yield* startNodeRelay();
      yield* Effect.promise(() => connect(relay.port, hostOnly, offered(claim)));
      const intruder = yield* Effect.promise(() => connect(relay.port, hostOnly, offered(other)));
      expect((yield* Effect.promise(() => intruder.closed)).code).toBe(1008);
    }),
  );

  it.effect("is the same host as one that used the address form: the claim is the claim", () =>
    Effect.gen(function* () {
      const relay = yield* startNodeRelay();
      const legacy = yield* Effect.promise(() =>
        connect(relay.port, hostPath(room, Buffer.from(claim).toString("base64url"))),
      );
      const next = yield* Effect.promise(() => connect(relay.port, hostOnly, offered(claim)));
      expect((yield* Effect.promise(() => legacy.closed)).code).toBe(1012);
      next.socket.send("ping");
      expect((yield* Effect.promise(() => next.messagesAfter(1)))[0]?.data.toString()).toBe("pong");
    }),
  );

  it.effect("is turned away with 404 without a claim among its subprotocols", () =>
    Effect.gen(function* () {
      const relay = yield* startNodeRelay();
      expect(yield* Effect.promise(() => open(relay.port, hostOnly, [relayProtocol]))).toEqual({ status: 404 });
    }),
  );
});

describe("a host of an earlier release, with its claim in the address", () => {
  it.effect("is accepted while the transition lasts", () =>
    Effect.gen(function* () {
      const relay = yield* startNodeRelay();
      yield* TestClock.setTime(legacyClaimUntil - 1);
      const host = yield* Effect.promise(() => connect(relay.port, hostPath()));
      host.socket.send("ping");
      expect((yield* Effect.promise(() => host.messagesAfter(1)))[0]?.data.toString()).toBe("pong");
    }),
  );

  it.effect("is turned away with 404 from the end date on, while the subprotocol form still works", () =>
    Effect.gen(function* () {
      const relay = yield* startNodeRelay();
      yield* TestClock.setTime(legacyClaimUntil);
      expect(yield* Effect.promise(() => open(relay.port, hostPath()))).toEqual({ status: 404 });
      const host = yield* Effect.promise(() => connect(relay.port, hostOnly, offered(claim)));
      host.socket.send("ping");
      expect((yield* Effect.promise(() => host.messagesAfter(1)))[0]?.data.toString()).toBe("pong");
      expect(relay.rooms()).toBe(1);
    }),
  );

  it.effect("does not change what a client sees: clients never carry a claim", () =>
    Effect.gen(function* () {
      const relay = yield* startNodeRelay();
      yield* TestClock.setTime(legacyClaimUntil);
      const client = yield* Effect.promise(() => connect(relay.port, clientPath()));
      expect((yield* Effect.promise(() => client.closed)).code).toBe(1013);
    }),
  );
});

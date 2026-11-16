import { it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, vi } from "vitest";
import { startNodeRelay } from "../src/index.ts";
import { clientPath, connect, hostPath, secret } from "./fixtures/wsClient.ts";

// Which rooms the node relay holds (ST-H-12): only a host makes one, and an empty one is dropped after its idle period.

const first = "abcdefghijklmnopqrstuvwxyz012345";
const second = "ABCDEFGHIJKLMNOPQRSTUVWXYZ012345";
const otherSecret = Buffer.from("another-sixteen-plus-byte-secret").toString("base64url");
const idleRoomMillis = 60_000;

/** A host that holds `name` with `claim` for a moment and leaves; resolves once the relay has seen it leave. */
const holdAndLeave = (port: number, name: string, claim = secret) =>
  Effect.promise(async () => {
    const host = await connect(port, hostPath(name, claim));
    host.socket.close();
    await host.closed;
    // The relay learns of the close a moment after the host does: a client is told "host offline" once it has.
    await vi.waitFor(async () => {
      const probe = await connect(port, clientPath(name));
      const { code } = await probe.closed;
      expect(code).toBe(1013);
    });
  });

describe("the rooms the node relay holds", () => {
  it.effect("makes no room for a client of a room nobody holds, and tells it the host is offline", () =>
    Effect.gen(function* () {
      const relay = yield* startNodeRelay();
      const closed = yield* Effect.promise(async () => (await connect(relay.port, clientPath(first))).closed);
      expect(closed).toEqual({ code: 1013, reason: "host offline" });
      expect(relay.rooms()).toBe(0);
    }),
  );

  it.effect("makes a room for a host", () =>
    Effect.gen(function* () {
      const relay = yield* startNodeRelay();
      yield* Effect.promise(() => connect(relay.port, hostPath(first)));
      expect(relay.rooms()).toBe(1);
    }),
  );

  it.effect("keeps an empty room and its claim until the idle period has passed", () =>
    Effect.gen(function* () {
      const relay = yield* startNodeRelay({ idleRoomMillis });
      yield* holdAndLeave(relay.port, first);
      yield* TestClock.adjust(idleRoomMillis - 1);
      // Another room arrives just before the period ends: the first is still held, with its claim.
      yield* Effect.promise(() => connect(relay.port, hostPath(second)));
      expect(relay.rooms()).toBe(2);
      const intruder = yield* Effect.promise(() => connect(relay.port, hostPath(first, otherSecret)));
      expect((yield* Effect.promise(() => intruder.closed)).code).toBe(1008);
    }),
  );

  it.effect("drops an empty room that has been idle for the period when a new room is made", () =>
    Effect.gen(function* () {
      const relay = yield* startNodeRelay({ idleRoomMillis });
      yield* holdAndLeave(relay.port, first);
      yield* TestClock.adjust(idleRoomMillis);
      yield* Effect.promise(() => connect(relay.port, hostPath(second)));
      expect(relay.rooms()).toBe(1);
      // Its claim went with it: another host may now take the name.
      const taker = yield* Effect.promise(() => connect(relay.port, hostPath(first, otherSecret)));
      taker.socket.send("ping");
      expect((yield* Effect.promise(() => taker.messagesAfter(1)))[0]?.data.toString()).toBe("pong");
    }),
  );

  it.effect("never drops a room somebody is in", () =>
    Effect.gen(function* () {
      const relay = yield* startNodeRelay({ idleRoomMillis });
      yield* Effect.promise(() => connect(relay.port, hostPath(first)));
      yield* TestClock.adjust(idleRoomMillis * 10);
      yield* Effect.promise(() => connect(relay.port, hostPath(second)));
      expect(relay.rooms()).toBe(2);
    }),
  );
});

import { it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, vi } from "vitest";
import { startNodeRelay } from "../src/index.ts";
import { defaultMaxRooms } from "../src/nodeRelay.ts";
import { clientPath, connect, hostPath, open, secret } from "./fixtures/wsClient.ts";

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

describe("the room cap of the node relay", () => {
  it.effect("tells a host that would make a room over the cap why it is turned away, and keeps the others", () =>
    Effect.gen(function* () {
      const relay = yield* startNodeRelay({ maxRooms: 2 });
      yield* Effect.promise(() => connect(relay.port, hostPath(first)));
      yield* Effect.promise(() => connect(relay.port, hostPath(second)));
      const third = "0123456789abcdefghijklmnopqrstuv";
      const refused = yield* Effect.promise(async () => (await connect(relay.port, hostPath(third))).closed);
      expect(refused).toEqual({ code: 4029, reason: "too many rooms" });
      expect(relay.rooms()).toBe(2);
      // The host of a room the relay holds is not affected: it reconnects with its claim.
      const again = yield* Effect.promise(() => connect(relay.port, hostPath(first)));
      again.socket.send("ping");
      expect((yield* Effect.promise(() => again.messagesAfter(1)))[0]?.data.toString()).toBe("pong");
    }),
  );

  it.effect("takes the room again once an idle room has been dropped", () =>
    Effect.gen(function* () {
      const relay = yield* startNodeRelay({ idleRoomMillis, maxRooms: 1 });
      yield* holdAndLeave(relay.port, first);
      yield* TestClock.adjust(idleRoomMillis);
      const accepted = yield* Effect.promise(() => connect(relay.port, hostPath(second)));
      accepted.socket.send("ping");
      expect((yield* Effect.promise(() => accepted.messagesAfter(1)))[0]?.data.toString()).toBe("pong");
      expect(relay.rooms()).toBe(1);
    }),
  );

  it("is 10,000 rooms by default", () => {
    expect(defaultMaxRooms).toBe(10_000);
  });
});

describe("the attempts per source of the node relay", () => {
  it.effect("refuses a source over its limit with 429 and accepts it again when the minute has passed", () =>
    Effect.gen(function* () {
      const relay = yield* startNodeRelay({ sourceLimits: { perHour: 100, perMinute: 3 } });
      for (let index = 0; index < 3; index++) yield* Effect.promise(() => open(relay.port, clientPath(first)));
      expect(yield* Effect.promise(() => open(relay.port, clientPath(first)))).toEqual({ status: 429 });
      expect(relay.rooms()).toBe(0);
      yield* TestClock.adjust(60_000);
      const again = yield* Effect.promise(() => open(relay.port, hostPath(first)));
      expect("status" in again).toBe(false);
    }),
  );

  it.effect("does not count an address that is not a room against the source", () =>
    Effect.gen(function* () {
      const relay = yield* startNodeRelay({ sourceLimits: { perHour: 100, perMinute: 1 } });
      for (let index = 0; index < 5; index++)
        expect(yield* Effect.promise(() => open(relay.port, "/status"))).toEqual({ status: 404 });
      const real = yield* Effect.promise(() => open(relay.port, hostPath(first)));
      expect("status" in real).toBe(false);
    }),
  );
});

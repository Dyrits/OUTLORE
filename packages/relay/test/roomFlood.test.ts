import { it as effectIt } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vitest";
import { defaultRoomLimits, relayFrame } from "../src/roomCore.ts";
import { createFakeRoom } from "./fixtures/fakeRoom.ts";

const bytes = (...values: number[]) => Uint8Array.from(values);

describe("a connection that floods the room with frames", () => {
  const limits = { frameBurst: 4, maxFramesPerSecond: 2 };

  effectIt.effect("is closed as rate limited once its burst is spent, and leaves the room", () =>
    Effect.gen(function* () {
      const { connectEffect, core } = createFakeRoom(limits);
      const host = yield* connectEffect("host", "first");
      const client = yield* connectEffect("client");
      for (let index = 0; index < 4; index++) yield* core.receive(client, bytes(index));
      expect(client.closed).toBeNull();
      yield* core.receive(client, bytes(9));
      expect(client.closed).toEqual({ code: 4029, reason: "rate limited" });
      expect(host.frames().filter((frame) => frame[0] === relayFrame.forward)).toHaveLength(4);
      expect(host.frames().at(-1)?.[0]).toBe(relayFrame.left);
    }),
  );

  effectIt.effect("lets a steady flow at the allowed rate through, however long it lasts", () =>
    Effect.gen(function* () {
      const { connectEffect, core } = createFakeRoom(limits);
      yield* connectEffect("host", "first");
      const client = yield* connectEffect("client");
      for (let index = 0; index < 20; index++) {
        yield* core.receive(client, bytes(index));
        yield* core.receive(client, bytes(index));
        yield* TestClock.adjust(1_000);
      }
      expect(client.closed).toBeNull();
    }),
  );

  effectIt.effect("refills with time: a spent burst is back after the refill period", () =>
    Effect.gen(function* () {
      const { connectEffect, core } = createFakeRoom(limits);
      yield* connectEffect("host", "first");
      const client = yield* connectEffect("client");
      for (let index = 0; index < 4; index++) yield* core.receive(client, bytes(index));
      yield* TestClock.adjust(2_000);
      for (let index = 0; index < 4; index++) yield* core.receive(client, bytes(index));
      expect(client.closed).toBeNull();
    }),
  );

  effectIt.effect("does not touch the other connections of the room", () =>
    Effect.gen(function* () {
      const { connectEffect, core } = createFakeRoom(limits);
      const host = yield* connectEffect("host", "first");
      const noisy = yield* connectEffect("client");
      const quiet = yield* connectEffect("client");
      for (let index = 0; index < 5; index++) yield* core.receive(noisy, bytes(index));
      yield* core.receive(quiet, bytes(1));
      expect(noisy.closed?.code).toBe(4029);
      expect(quiet.closed).toBeNull();
      expect(host.closed).toBeNull();
    }),
  );

  effectIt.effect("counts a host's frames and text frames the same way", () =>
    Effect.gen(function* () {
      const { connectEffect, core } = createFakeRoom(limits);
      const host = yield* connectEffect("host", "first");
      for (let index = 0; index < 5; index++) yield* core.receive(host, "ping");
      expect(host.closed).toEqual({ code: 4029, reason: "rate limited" });
    }),
  );
});

describe("the default frame budget", () => {
  it("is 200 frames a second with a burst of 400", () => {
    expect(defaultRoomLimits.maxFramesPerSecond).toBe(200);
    expect(defaultRoomLimits.frameBurst).toBe(400);
  });
});

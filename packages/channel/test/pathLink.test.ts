import { it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect } from "vitest";
import { maxLinkMessageBytes, pathTimings } from "../src/index.ts";
import { settle } from "./fixtures/fakeCarrier.ts";
import { directChannels, linkedPair, watched } from "./fixtures/linkedPair.ts";

const flush = Effect.promise(settle);
const texts = (count: number, prefix = "message") =>
  Array.from({ length: count }, (_, index) => `{"n":"${prefix}${index}"}`);

/** A device and a host that both speak frames, with a direct channel attached on both sides and confirmed. */
const upgraded = Effect.gen(function* () {
  const pair = yield* linkedPair();
  const received = { device: watched(pair.device), host: watched(pair.host) };
  pair.device.enableFrames();
  yield* flush;
  const direct = yield* directChannels;
  pair.device.attachDirect(direct.device);
  pair.host.attachDirect(direct.responder);
  yield* flush;
  return { ...pair, direct, received };
});

describe("a link over the relay", () => {
  it.effect("carries messages unframed until a side asks for frames", () =>
    Effect.gen(function* () {
      const pair = yield* linkedPair();
      const received = { device: watched(pair.device), host: watched(pair.host) };
      pair.device.sendText('{"hello":1}');
      pair.host.sendText('{"reply":1}');
      yield* flush;
      expect(received.host.texts).toEqual(['{"hello":1}']);
      expect(received.device.texts).toEqual(['{"reply":1}']);
      expect(pair.device.isFramed).toBe(false);
      expect(pair.host.isFramed).toBe(false);
    }),
  );

  it.effect("switches both sides to frames when the device asks, and loses nothing sent around it", () =>
    Effect.gen(function* () {
      const pair = yield* linkedPair();
      const received = { device: watched(pair.device), host: watched(pair.host) };
      pair.host.sendText('{"early":1}');
      pair.device.enableFrames();
      pair.device.sendText('{"first":1}');
      yield* flush;
      pair.host.sendText('{"late":1}');
      yield* flush;
      expect(pair.host.isFramed).toBe(true);
      expect(received.host.texts).toEqual(['{"first":1}']);
      expect(received.device.texts).toEqual(['{"early":1}', '{"late":1}']);
    }),
  );

  it.effect("passes an unframed message from the relay even after frames are on", () =>
    Effect.gen(function* () {
      const pair = yield* linkedPair();
      const received = watched(pair.host);
      pair.device.enableFrames();
      yield* flush;
      // Written below the link, as a host of an earlier release would send it.
      pair.relay.secureDevice.sendText('{"old":1}');
      yield* flush;
      expect(received.texts).toEqual(['{"old":1}']);
      expect(received.isClosed).toBe(false);
    }),
  );

  it.effect("refuses a message over the largest a frame can carry", () =>
    Effect.gen(function* () {
      const pair = yield* linkedPair();
      expect(() => pair.device.send(new Uint8Array(maxLinkMessageBytes + 1))).toThrow(RangeError);
    }),
  );
});

describe("a link with a direct channel", () => {
  it.effect("sends on the direct channel once both sides have spoken on it, and the relay carries nothing more", () =>
    Effect.gen(function* () {
      const { device, host, received, relay } = yield* upgraded;
      expect(device.path).toBe("direct");
      expect(host.path).toBe("direct");
      const relayFramesBefore = relay.deviceCarrier.sent.length + relay.hostCarrier.sent.length;
      for (const text of texts(50)) device.sendText(text);
      for (const text of texts(50, "reply")) host.sendText(text);
      yield* flush;
      expect(received.host.texts).toEqual(texts(50));
      expect(received.device.texts).toEqual(texts(50, "reply"));
      expect(relay.deviceCarrier.sent.length + relay.hostCarrier.sent.length).toBe(relayFramesBefore);
    }),
  );

  it.effect("keeps order when messages leave on the relay and then on the direct channel", () =>
    Effect.gen(function* () {
      const pair = yield* linkedPair();
      const received = watched(pair.host);
      pair.device.enableFrames();
      yield* flush;
      const direct = yield* directChannels;
      for (const text of texts(3, "before")) pair.device.sendText(text);
      pair.device.attachDirect(direct.device);
      pair.host.attachDirect(direct.responder);
      yield* flush;
      for (const text of texts(3, "after")) pair.device.sendText(text);
      yield* flush;
      expect(received.texts).toEqual([...texts(3, "before"), ...texts(3, "after")]);
    }),
  );

  it.effect("never writes a message in the clear on the direct carrier", () =>
    Effect.gen(function* () {
      const { device, direct } = yield* upgraded;
      device.sendText('{"secret":"needle-in-a-haystack"}');
      yield* flush;
      const onWire = [...direct.deviceCarrier.sent, ...direct.hostCarrier.sent].map((bytes) =>
        Buffer.from(bytes).toString("latin1"),
      );
      expect(onWire.length).toBeGreaterThan(0);
      expect(onWire.some((text) => text.includes("needle"))).toBe(false);
    }),
  );

  it.effect(
    "replays what the direct channel had not acknowledged over the relay when it drops, once and in order",
    () =>
      Effect.gen(function* () {
        const { device, host, direct, received, relay } = yield* upgraded;
        for (const text of texts(5, "acked")) device.sendText(text);
        yield* flush;
        // The direct carrier loses everything from here on without saying so, then dies: what was in flight is gone.
        const lost = texts(5, "lost");
        direct.deviceCarrier.send = () => undefined;
        for (const text of lost) device.sendText(text);
        direct.deviceCarrier.close();
        yield* flush;
        expect(device.path).toBe("relay");
        expect(host.path).toBe("relay");
        device.sendText('{"n":"after"}');
        yield* flush;
        expect(received.host.texts).toEqual([...texts(5, "acked"), ...lost, '{"n":"after"}']);
        expect(relay.deviceCarrier.sent.length).toBeGreaterThan(0);
      }),
  );

  it.effect("drops a replayed message the other side had already received", () =>
    Effect.gen(function* () {
      const { device, direct, received } = yield* upgraded;
      for (const text of texts(3)) device.sendText(text);
      yield* flush;
      // Nothing was acknowledged yet (under 16 messages and no beat): the whole of it goes again, and no more shows.
      direct.deviceCarrier.close();
      yield* flush;
      expect(received.host.texts).toEqual(texts(3));
    }),
  );

  it.effect("gives up a direct channel that goes silent after the missed beats and falls back", () =>
    Effect.gen(function* () {
      const { device, host, direct } = yield* upgraded;
      direct.hostCarrier.send = () => undefined;
      yield* TestClock.adjust(pathTimings.beatMillis * (pathTimings.maxSilentBeats + 1));
      yield* flush;
      expect(device.path).toBe("relay");
      expect(host.path).toBe("relay");
    }),
  );

  it.effect("tells a path change to its listener", () =>
    Effect.gen(function* () {
      const pair = yield* linkedPair();
      const seen: string[] = [];
      pair.device.onPath((path) => seen.push(path));
      pair.device.enableFrames();
      yield* flush;
      const direct = yield* directChannels;
      pair.device.attachDirect(direct.device);
      pair.host.attachDirect(direct.responder);
      yield* flush;
      direct.deviceCarrier.close();
      yield* flush;
      expect(seen).toEqual(["direct", "relay"]);
    }),
  );

  it.effect("keeps going on the direct channel alone when the relay ends, and ends when that does", () =>
    Effect.gen(function* () {
      const { device, direct, received, relay } = yield* upgraded;
      relay.hostCarrier.close();
      yield* flush;
      expect(received.host.isClosed).toBe(false);
      device.sendText('{"n":"still-here"}');
      yield* flush;
      expect(received.host.texts).toEqual(['{"n":"still-here"}']);
      direct.deviceCarrier.close();
      yield* flush;
      expect(received.host.isClosed).toBe(true);
      expect(received.device.isClosed).toBe(true);
    }),
  );

  it.effect("closes the direct channel with the link", () =>
    Effect.gen(function* () {
      const { device, direct, received } = yield* upgraded;
      device.close();
      yield* flush;
      expect(received.host.isClosed).toBe(true);
      expect(direct.hostCarrier.isClosed()).toBe(true);
    }),
  );

  it.effect("ignores a direct channel attached before frames are on, and closes it", () =>
    Effect.gen(function* () {
      const pair = yield* linkedPair();
      const direct = yield* directChannels;
      pair.device.attachDirect(direct.device);
      expect(direct.deviceCarrier.isClosed()).toBe(true);
      expect(pair.device.path).toBe("relay");
    }),
  );
});

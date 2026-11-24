import { it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect } from "vitest";
import {
  type DirectSettings,
  defaultDirectTimings,
  makeDirectSlots,
  parseDirectControl,
  runDeviceUpgrade,
  serveHostUpgrade,
} from "../src/index.ts";
import { settle } from "./fixtures/fakeCarrier.ts";
import { fakePeerNetwork } from "./fixtures/fakePeers.ts";
import { securePair, watched } from "./fixtures/linkedPair.ts";

const flush = Effect.promise(settle);
const timings = defaultDirectTimings;

/** Lets real I/O settle and the fake clock move on, a few times over. */
const advance = (millis: number) =>
  Effect.gen(function* () {
    yield* flush;
    yield* TestClock.adjust(millis);
    yield* flush;
    yield* flush;
  });

const scene = (options: { isAccepting?: () => boolean; maxPeers?: number } = {}) =>
  Effect.gen(function* () {
    const network = fakePeerNetwork();
    const relay = yield* securePair;
    const { makePathLink } = yield* Effect.promise(() => import("../src/index.ts"));
    const device = yield* makePathLink(relay.device);
    const host = yield* makePathLink(relay.responder);
    const settings = (peers: DirectSettings["peers"]): DirectSettings => ({
      peers,
      stunServers: ["stun:stun.example.test:3478"],
    });
    device.enableFrames();
    const sent = { control: [] as string[] };
    const received = { device: watched(device), host: watched(host) };
    host.onControl((text) => sent.control.push(text));
    yield* serveHostUpgrade(host, {
      hostKeyPair: relay.host,
      isAccepting: options.isAccepting ?? (() => true),
      room: "room-1",
      settings: settings(network.hostPeers),
      slots: makeDirectSlots(options.maxPeers ?? 4),
    });
    const upgrade = yield* Effect.forkDetach(
      runDeviceUpgrade(device, {
        hostPublicKey: relay.host.publicKey,
        room: "room-1",
        settings: settings(network.devicePeers),
      }),
    );
    return { device, host, network, received, relay, sent, upgrade };
  });

describe("making a direct channel", () => {
  it.effect("connects, runs the Noise handshake inside the channel, and moves the link onto it", () =>
    Effect.gen(function* () {
      const { device, host, network, received, relay } = yield* scene();
      yield* advance(0);
      yield* advance(0);
      expect(device.path).toBe("direct");
      expect(host.path).toBe("direct");
      // The first two messages on the direct carrier are the two Noise NK handshake messages: an ephemeral key and
      // an empty payload's tag, 32 + 16 bytes each, and nothing that reads as text.
      const carrier = network.state.carriers[0];
      expect(carrier?.device.sent[0]?.byteLength).toBe(48);
      expect(carrier?.host.sent[0]?.byteLength).toBe(48);
      const relayBefore = relay.deviceCarrier.sent.length + relay.hostCarrier.sent.length;
      device.sendText('{"ask":"ReadHostName"}');
      host.sendText('{"answer":"Host Mac"}');
      yield* flush;
      expect(received.host.texts).toEqual(['{"ask":"ReadHostName"}']);
      expect(received.device.texts).toEqual(['{"answer":"Host Mac"}']);
      expect(relay.deviceCarrier.sent.length + relay.hostCarrier.sent.length).toBe(relayBefore);
      const wire = (carrier?.device.sent ?? []).concat(carrier?.host.sent ?? []);
      expect(wire.some((bytes) => Buffer.from(bytes).toString("latin1").includes("ReadHostName"))).toBe(false);
    }),
  );

  it.effect("sends only a description and an answer through the relay, inside the secure channel", () =>
    Effect.gen(function* () {
      const { relay, sent } = yield* scene();
      yield* advance(0);
      expect(sent.control.map((text) => parseDirectControl(text)?._tag)).toEqual(["DirectOffer"]);
      // Everything the relay saw is ciphertext: the descriptions are not in it.
      const seen = [...relay.deviceCarrier.sent, ...relay.hostCarrier.sent].map((bytes) =>
        Buffer.from(bytes).toString("latin1"),
      );
      expect(seen.some((text) => text.includes("offer-") || text.includes("answer-to-"))).toBe(false);
    }),
  );

  it.effect("asks the STUN servers it was given", () =>
    Effect.gen(function* () {
      const { network } = yield* scene();
      yield* advance(0);
      expect(network.state.stunServers).toEqual([["stun:stun.example.test:3478"], ["stun:stun.example.test:3478"]]);
    }),
  );

  it.effect("stays on the relay when the channel never opens, and tries again after the wait", () =>
    Effect.gen(function* () {
      const { device, host, network, received } = yield* scene();
      network.state.isBlocked = true;
      yield* advance(0);
      yield* advance(timings.openMillis + 1);
      expect(device.path).toBe("relay");
      // The failed try closed both of its peers.
      expect(network.state.closedPeers).toBe(2);
      device.sendText('{"still":"works"}');
      yield* flush;
      expect(received.host.texts).toEqual(['{"still":"works"}']);
      network.state.isBlocked = false;
      yield* advance(timings.firstRetryMillis + 1);
      yield* advance(0);
      expect(device.path).toBe("direct");
      expect(host.path).toBe("direct");
      expect(network.state.openedDevicePeers).toBe(2);
    }),
  );

  it.effect("doubles the wait after each failed try, up to the longest", () =>
    Effect.gen(function* () {
      const { network } = yield* scene();
      network.state.isBlocked = true;
      yield* advance(0);
      yield* advance(timings.openMillis + 1);
      expect(network.state.openedDevicePeers).toBe(1);
      yield* advance(timings.firstRetryMillis + 1);
      yield* advance(0);
      expect(network.state.openedDevicePeers).toBe(2);
      // The second wait is twice the first: one first-wait later nothing has started yet.
      yield* advance(timings.openMillis + timings.firstRetryMillis);
      expect(network.state.openedDevicePeers).toBe(2);
      yield* advance(timings.firstRetryMillis + 1);
      yield* advance(0);
      expect(network.state.openedDevicePeers).toBe(3);
    }),
  );

  it.effect("falls back to the relay without losing a message when the channel closes, then upgrades again", () =>
    Effect.gen(function* () {
      const { device, host, network, received } = yield* scene();
      yield* advance(0);
      yield* advance(0);
      expect(device.path).toBe("direct");
      device.sendText('{"n":1}');
      yield* flush;
      network.state.carriers[0]?.device.close();
      yield* flush;
      expect(device.path).toBe("relay");
      expect(host.path).toBe("relay");
      device.sendText('{"n":2}');
      host.sendText('{"n":"back"}');
      yield* flush;
      expect(received.host.texts).toEqual(['{"n":1}', '{"n":2}']);
      expect(received.device.texts).toEqual(['{"n":"back"}']);
      yield* advance(timings.afterDropMillis + 1);
      yield* advance(0);
      expect(device.path).toBe("direct");
      expect(host.path).toBe("direct");
    }),
  );

  it.effect("makes no direct channel while the host is not accepting, and says so", () =>
    Effect.gen(function* () {
      const { device, network } = yield* scene({ isAccepting: () => false });
      yield* advance(0);
      expect(device.path).toBe("relay");
      expect(network.state.openedHostPeers).toBe(0);
      // The device's peer is closed once the refusal arrives.
      yield* advance(0);
      expect(network.state.closedPeers).toBe(1);
    }),
  );

  it.effect("turns an offer away when the host holds all the peers it will", () =>
    Effect.gen(function* () {
      const { device, network } = yield* scene({ maxPeers: 0 });
      yield* advance(0);
      expect(device.path).toBe("relay");
      expect(network.state.openedHostPeers).toBe(0);
    }),
  );

  it.effect("does not attach a channel whose Noise handshake is for another host", () =>
    Effect.gen(function* () {
      const network = fakePeerNetwork();
      const relay = yield* securePair;
      const { generateKeyPair, makePathLink } = yield* Effect.promise(() => import("../src/index.ts"));
      const device = yield* makePathLink(relay.device);
      const host = yield* makePathLink(relay.responder);
      device.enableFrames();
      const other = generateKeyPair();
      yield* serveHostUpgrade(host, {
        hostKeyPair: relay.host,
        isAccepting: () => true,
        room: "room-1",
        settings: { peers: network.hostPeers, stunServers: [] },
        slots: makeDirectSlots(1),
      });
      yield* Effect.forkDetach(
        runDeviceUpgrade(device, {
          // The device holds a key that is not the host's: what a stranger in the middle would have.
          hostPublicKey: other.publicKey,
          room: "room-1",
          settings: { peers: network.devicePeers, stunServers: [] },
        }),
      );
      yield* advance(0);
      yield* advance(timings.handshakeMillis + 1);
      expect(device.path).toBe("relay");
      expect(host.path).toBe("relay");
    }),
  );

  it.effect("ends its tries when the fiber is interrupted", () =>
    Effect.gen(function* () {
      const { network, upgrade } = yield* scene();
      network.state.isBlocked = true;
      yield* advance(0);
      yield* Fiber.interrupt(upgrade);
      yield* advance(timings.firstRetryMillis * 10);
      expect(network.state.openedDevicePeers).toBe(1);
      expect(network.state.closedPeers).toBeGreaterThanOrEqual(1);
    }),
  );
});

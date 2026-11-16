import { describe, expect, it } from "@effect/vitest";
import { type Carrier, generateKeyPair, openInitiator, roomPrologue, type SecureChannel } from "@outlore/channel";
import type { HostConnection } from "@outlore/relay";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { createDeviceServer, type DeviceServerParts } from "../../src/remote/hostSession.ts";

// A device has 15 seconds to finish the handshake and say who it is; the host closes its connection otherwise. The
// time is the test clock's: a stand-in relay connection and a device that goes quiet at a chosen point.

const room = "abcdefghijklmnopqrstuvwxyz012345";
const clientId = "00".repeat(16);
const keys = generateKeyPair();
const record = {
  claimSecret: new Uint8Array(32),
  hostName: null,
  isEnabled: true,
  publicKey: keys.publicKey,
  relayOrigin: null,
  room,
  secretKey: keys.secretKey,
};
const parts: DeviceServerParts = {
  addSession: () => () => {},
  admitDevice: async () => null,
  announce: () => {},
  answer: () => {},
  isAccepting: () => true,
  run: async () => {
    throw new Error("not used");
  },
  runInTransaction: async () => {
    throw new Error("not used");
  },
};
const turn = Effect.promise(() => new Promise<void>((resolve) => setImmediate(resolve)));

/** The host's connection to the relay, as one client sees it, and that client's end. */
const standIn = () => {
  const server = createDeviceServer(parts);
  const closed: string[] = [];
  const device: { messages: Array<(data: Uint8Array) => void>; closes: Array<() => void> } = {
    closes: [],
    messages: [],
  };
  const connection = {
    closeClient: (id: string) => {
      closed.push(id);
      for (const listener of device.closes) queueMicrotask(listener);
    },
    sendToClient: (_id: string, data: Uint8Array) => {
      for (const listener of device.messages) queueMicrotask(() => listener(data));
    },
  } as unknown as HostConnection;
  const carrier: Carrier = {
    close: () => {},
    onClose: (listener) => void device.closes.push(listener),
    onMessage: (listener) => void device.messages.push(listener),
    send: (data) => server.deliver(clientId, data.slice()),
  };
  return { carrier, closed, connection, server };
};

describe("a device joining the host's room", () => {
  it.effect("is closed after 15 seconds when it never starts the handshake", () =>
    Effect.gen(function* () {
      const { closed, connection, server } = standIn();
      const serving = yield* Effect.forkChild(server.serve(connection, record, clientId), { startImmediately: true });
      yield* TestClock.adjust(14_999);
      expect(closed).toEqual([]);
      yield* TestClock.adjust(1);
      yield* Fiber.join(serving);
      expect(closed).toEqual([clientId]);
    }),
  );

  it.effect("is closed after 15 seconds when it finishes the handshake but never says who it is", () =>
    Effect.gen(function* () {
      const { carrier, closed, connection, server } = standIn();
      const serving = yield* Effect.forkChild(server.serve(connection, record, clientId), { startImmediately: true });
      const channel: SecureChannel = yield* openInitiator(carrier, keys.publicKey, roomPrologue(room));
      yield* turn;
      yield* TestClock.adjust(14_999);
      expect(closed).toEqual([]);
      yield* TestClock.adjust(1);
      yield* Fiber.join(serving);
      expect(closed).toEqual([clientId]);
      expect(channel).toBeDefined();
    }),
  );

  it.effect("is closed at once, with the failure not thrown, when its first message is not a hello", () =>
    Effect.gen(function* () {
      const { carrier, closed, connection, server } = standIn();
      const serving = yield* Effect.forkChild(server.serve(connection, record, clientId), { startImmediately: true });
      const channel = yield* openInitiator(carrier, keys.publicKey, roomPrologue(room));
      channel.sendText("not a hello");
      yield* Fiber.join(serving);
      expect(closed).toEqual([clientId]);
    }),
  );
});

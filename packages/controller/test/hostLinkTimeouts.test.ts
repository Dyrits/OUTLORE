import { describe, expect, it } from "@effect/vitest";
import { type Carrier, generateKeyPair, openResponder, roomPrologue, type SecureChannel } from "@outlore/channel";
import { connectHost, type HostConnection, startNodeRelay } from "@outlore/relay";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { type HostLinkRecord, type PairedHostStore, resumeHost } from "../src/index.ts";
import { linkTexts } from "../src/linkFailure.ts";

// How long a link may take is the clock's business, not the wall's: the 20 seconds of pairing and opening run on the
// test clock, over a real local relay and a stand-in host that stops answering at a chosen point.

const room = "abcdefghijklmnopqrstuvwxyz012345";
const settings = { allowLocalRelay: true, kind: "desktop", release: "development" } as const;
const turn = Effect.promise(() => new Promise<void>((resolve) => setImmediate(resolve)));

/** One client of the host's room as the secure channel's carrier. */
const carrierOf = (connection: HostConnection, clientId: string) => {
  const messages: Array<(data: Uint8Array) => void> = [];
  const closes: Array<() => void> = [];
  connection.onClientData((from, data) => {
    if (from === clientId) for (const listener of messages) listener(data);
  });
  connection.onClientLeft((from) => {
    if (from === clientId) for (const listener of closes) listener();
  });
  return {
    close: () => connection.closeClient(clientId),
    onClose: (listener) => void closes.push(listener),
    onMessage: (listener) => void messages.push(listener),
    send: (data) => connection.sendToClient(clientId, data),
  } satisfies Carrier;
};

/** A relay, a host that handles each joining client as `onClient` says, and a store with one paired host. */
const world = (onClient: (carrier: Carrier, host: ReturnType<typeof generateKeyPair>) => void) =>
  Effect.gen(function* () {
    const relay = yield* startNodeRelay();
    const relayOrigin = `http://127.0.0.1:${relay.port}`;
    const host = generateKeyPair();
    const connection = yield* connectHost({ claim: new Uint8Array(32).fill(7), relayOrigin, room });
    connection.onClientJoined((clientId) => onClient(carrierOf(connection, clientId), host));
    const record: HostLinkRecord = {
      deviceId: "device",
      deviceToken: "token",
      hostName: "Host",
      hostPublicKey: host.publicKey,
      relayOrigin,
      room,
    };
    const store: PairedHostStore = {
      link: async () => record,
      save: async () => {
        throw new Error("not used");
      },
      touch: async () => {},
    };
    return { store };
  });

describe("the time a host link may take", () => {
  it.effect("gives up after 20 seconds when the host never completes the handshake, and closes", () =>
    Effect.scoped(
      Effect.gen(function* () {
        let joined = 0;
        const { store } = yield* world(() => {
          joined += 1;
        });
        const opening = yield* Effect.forkChild(Effect.flip(resumeHost(store, "host", settings)));
        while (joined === 0) yield* turn;
        yield* turn;
        yield* TestClock.adjust(19_999);
        expect(opening.pollUnsafe()).toBeUndefined();
        yield* TestClock.adjust(1);
        const failure = yield* Fiber.join(opening);
        expect(failure).toMatchObject({ kind: "couldNotOpen", message: linkTexts.timedOut });
      }),
    ),
  );

  it.effect("gives up after 20 seconds when the host never answers its hello, and closes the channel", () =>
    Effect.scoped(
      Effect.gen(function* () {
        let hello = 0;
        let channel: SecureChannel | null = null;
        let closes = 0;
        const { store } = yield* world((carrier, host) => {
          void Effect.runPromise(openResponder(carrier, host, roomPrologue(room))).then((opened) => {
            channel = opened;
            opened.onClose(() => {
              closes += 1;
            });
            opened.onText(() => {
              hello += 1;
            });
          });
        });
        const opening = yield* Effect.forkChild(Effect.flip(resumeHost(store, "host", settings)));
        while (hello === 0) yield* turn;
        yield* TestClock.adjust(19_999);
        expect(opening.pollUnsafe()).toBeUndefined();
        expect(closes).toBe(0);
        yield* TestClock.adjust(1);
        const failure = yield* Fiber.join(opening);
        expect(failure).toMatchObject({ kind: "couldNotOpen", message: linkTexts.timedOut });
        while (closes === 0) yield* turn;
        expect(channel).not.toBeNull();
      }),
    ),
  );
});

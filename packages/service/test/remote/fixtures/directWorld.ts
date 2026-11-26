import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Carrier, DirectPeer, DirectPeers, DirectSettings } from "@outlore/channel";
import { createPairedHosts, type KeyValueStorage, type OpenTransport } from "@outlore/controller";
import { openBrowserTransport, pairFromBrowser } from "@outlore/controller/browser";
import { startNodeRelay } from "@outlore/relay";
import { fakeHarnessLayer, Service, serviceLayer } from "@outlore/service";
import { Effect, Layer } from "effect";
import { weriftDirectSettings } from "../../../src/remote/index.ts";
import { directories, until } from "./pairingWorld.ts";

// A host (a whole service over its own database), a real local relay, and a controller that talks to the host
// through the same transport the web app uses; both sides make direct channels with werift over this machine's own
// addresses (no STUN server), so a real WebRTC stack carries the bytes (device-pairing, Direct path).

export const hostRelease = "0.2.7-Pre-Alpha";

/** Short waits, so that the tries a real clock paces finish in a test. */
export const quickTimings = {
  afterDropMillis: 200,
  answerMillis: 4_000,
  firstRetryMillis: 200,
  gatherMillis: 1_500,
  handshakeMillis: 4_000,
  longestRetryMillis: 400,
  openMillis: 3_000,
} as const;

/** What one side's data channel carried, as bytes. */
export interface Recorded {
  readonly received: Uint8Array[];
  readonly sent: Uint8Array[];
}

/** Peers that remember each peer they made and what its data channel carried; they can also refuse to connect. */
export const recordingPeers = (inner: DirectPeers) => {
  const state = { isBlocked: false, peers: [] as DirectPeer[], recorded: [] as Recorded[] };
  const peers: DirectPeers = {
    open: async (options) => {
      const peer = await inner.open(options);
      const wrapped: DirectPeer = {
        accept: async (answer) => {
          if (!state.isBlocked) await peer.accept(answer);
        },
        answer: (offer) => peer.answer(offer),
        close: () => peer.close(),
        offer: () => peer.offer(),
        onClosed: (listener) => peer.onClosed(listener),
        opened: async () => {
          const carrier = await peer.opened();
          const recorded: Recorded = { received: [], sent: [] };
          state.recorded.push(recorded);
          const recording: Carrier = {
            close: () => carrier.close(),
            onClose: (listener) => carrier.onClose(listener),
            onMessage: (listener) =>
              carrier.onMessage((data) => {
                recorded.received.push(data.slice());
                listener(data);
              }),
            send: (data) => {
              recorded.sent.push(data.slice());
              carrier.send(data);
            },
          };
          return recording;
        },
      };
      state.peers.push(wrapped);
      return wrapped;
    },
  };
  return { peers, state };
};

const memoryStorage = (): KeyValueStorage => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
};

interface Frame {
  readonly _tag: string;
  readonly id?: string;
  readonly value?: unknown;
}

/** A transport as the app's client holds it: what it received, how it ended, and a request with its answer. */
const driven = (openTransport: OpenTransport) => {
  const state = {
    closed: null as { code: number; reason: string } | null,
    frames: [] as Frame[],
    paths: [] as string[],
  };
  const transport = openTransport({
    onClose: (code, reason) => {
      state.closed = { code, reason };
    },
    onError: () => {},
    onOpen: () => {},
    onPath: (path) => state.paths.push(path),
    onText: (data) => state.frames.push(JSON.parse(String(data)) as Frame),
  });
  let next = 0;
  return {
    ask: (request: object) =>
      Effect.gen(function* () {
        const id = String(++next);
        transport.send(JSON.stringify({ id, request }));
        return yield* until(() => state.frames.find((frame) => frame.id === id));
      }),
    close: () => transport.close(),
    get closed() {
      return state.closed;
    },
    paths: state.paths,
  };
};

type DeviceView = { isConnected: boolean; isDirect: boolean };

/** The scene: the host's own view of the device, and one controller that pairs and opens a link. */
export const directWorld = Effect.gen(function* () {
  const relay = yield* startNodeRelay();
  const relayOrigin = `http://127.0.0.1:${relay.port}`;
  const directory = mkdtempSync(join(tmpdir(), "outlore-direct-"));
  directories.push(directory);
  const hostSide = recordingPeers(weriftDirectSettings([]).peers);
  const deviceSide = recordingPeers(weriftDirectSettings([]).peers);
  const settingsOf = (peers: DirectPeers): DirectSettings => ({ peers, stunServers: [], timings: quickTimings });
  const hostContext = yield* Layer.build(
    serviceLayer({
      computerName: "Host Mac",
      direct: settingsOf(hostSide.peers),
      filename: join(directory, "outlore.sqlite"),
      harness: fakeHarnessLayer("10 millis"),
      homeFolder: directory,
      relayOrigin,
      release: hostRelease,
      scratchRoot: join(directory, "missions"),
    }),
  );
  const host = (request: object) =>
    Effect.gen(function* () {
      const service = yield* Service;
      return yield* service.handle(request as never);
    }).pipe(Effect.provideContext(hostContext));
  /** The first paired device, as Workshop lists it. */
  const device = Effect.map(
    host({ _tag: "ReadRemoteAccess" }),
    (view) => (view as { devices: DeviceView[] }).devices[0],
  );
  /** Waits until the host lists the device as direct (or not). */
  const untilDirect = (isDirect: boolean) =>
    until(async () => ((await Effect.runPromise(device))?.isDirect === isDirect ? true : undefined));
  const allowPairing = Effect.gen(function* () {
    yield* until(() =>
      Effect.runPromise(host({ _tag: "ReadRemoteAccess" })).then((view) =>
        (view as { status: string }).status === "Off" ? view : undefined,
      ),
    );
    yield* Effect.sleep("150 millis");
    yield* host({ _tag: "SetRemoteAccess", isEnabled: true });
    yield* until(() =>
      Effect.runPromise(host({ _tag: "ReadRemoteAccess" })).then((view) =>
        (view as { status: string }).status === "Connected" ? view : undefined,
      ),
    );
  });
  /** Pairs, then opens a link; `linkRelease` makes the link's page run another release than the host (the update link). */
  const pairedLink = Effect.fnUntraced(function* (options: { linkRelease?: string } = {}) {
    yield* allowPairing;
    const code = ((yield* host({ _tag: "CreatePairingCode" })) as { code: string }).code;
    const hosts = createPairedHosts(memoryStorage());
    const page = {
      direct: settingsOf(deviceSide.peers),
      kind: "browser" as const,
      release: hostRelease,
      shouldAllowLocalRelay: true,
    };
    const known = yield* Effect.promise(() => pairFromBrowser(code, "Firefox", hosts, page));
    if (options.linkRelease === void 0) return driven(openBrowserTransport(hosts, known.id, page));
    const other = { ...page, release: options.linkRelease };
    return driven(openBrowserTransport(hosts, known.id, other, { shouldAcceptOtherRelease: true }));
  });
  return { device, deviceSide, host, hostSide, pairedLink, relay, untilDirect };
});

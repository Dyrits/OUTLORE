import { Effect } from "effect";
import {
  generateKeyPair,
  makePathLink,
  openInitiator,
  openResponder,
  type PathLink,
  type PathLinkOptions,
} from "../../src/index.ts";
import { type FakeCarrier, fakeCarrierPair } from "./fakeCarrier.ts";

const prologue = new TextEncoder().encode("room-1");

/** Two secure channels joined by fake carriers, as a device and a host hold them after the handshake. */
export const securePair = Effect.gen(function* () {
  const host = generateKeyPair();
  const [deviceCarrier, hostCarrier] = fakeCarrierPair();
  const [device, responder] = yield* Effect.all(
    [openInitiator(deviceCarrier, host.publicKey, prologue), openResponder(hostCarrier, host, prologue)],
    { concurrency: 2 },
  );
  return { device, deviceCarrier, host, hostCarrier, responder };
});

/** A device's and a host's link over a fake relay; both carriers are kept so that a test can count what crossed. */
export const linkedPair = (options: PathLinkOptions = {}) =>
  Effect.gen(function* () {
    const relay = yield* securePair;
    const device = yield* makePathLink(relay.device, options);
    const host = yield* makePathLink(relay.responder, options);
    return {
      device,
      host,
      relay: {
        deviceCarrier: relay.deviceCarrier,
        hostCarrier: relay.hostCarrier,
        /** The secure channels beneath the links, for a test that writes below them. */
        secureDevice: relay.device,
        secureHost: relay.responder,
      },
    };
  });

/** What the link's listeners saw: texts in order, and whether it ended. */
export const watched = (link: PathLink) => {
  const state = { isClosed: false, texts: [] as string[] };
  link.onText((text) => state.texts.push(text));
  link.onClose(() => {
    state.isClosed = true;
  });
  return state;
};

/** A fresh direct secure channel pair, with the carriers it travels on. */
export const directChannels = Effect.gen(function* () {
  const pair = yield* securePair;
  return pair as typeof pair & { deviceCarrier: FakeCarrier; hostCarrier: FakeCarrier };
});

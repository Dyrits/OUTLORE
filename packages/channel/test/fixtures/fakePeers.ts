import type { Carrier, DirectPeer, DirectPeers } from "../../src/index.ts";
import { type FakeCarrier, fakeCarrierPair } from "./fakeCarrier.ts";

interface Side {
  carrier: FakeCarrier | null;
  readonly closeListeners: Array<() => void>;
  end(): void;
  isClosed: boolean;
  readonly waiting: Array<(carrier: FakeCarrier) => void>;
}

/**
 * Stand-ins for WebRTC: a device's peer and a host's peer that join once the host has answered and the device has
 * accepted. A test can keep the channel from ever opening (a NAT that will not punch), end it, or watch what crossed.
 */
export const fakePeerNetwork = () => {
  const state = {
    answered: new Map<string, Side>(),
    carriers: [] as Array<{ device: FakeCarrier; host: FakeCarrier }>,
    closedPeers: 0,
    isBlocked: false,
    offers: 0,
    openedDevicePeers: 0,
    openedHostPeers: 0,
    stunServers: [] as Array<readonly string[]>,
  };

  const makeSide = (): Side => {
    const side: Side = {
      carrier: null,
      closeListeners: [],
      end: () => {
        if (side.isClosed) return;
        side.isClosed = true;
        state.closedPeers += 1;
        side.carrier?.close();
        for (const listener of side.closeListeners.splice(0)) listener();
      },
      isClosed: false,
      waiting: [],
    };
    return side;
  };

  const peerOf = (side: Side, hooks: Pick<DirectPeer, "accept" | "answer" | "offer">): DirectPeer => ({
    ...hooks,
    close: side.end,
    onClosed: (listener) => {
      if (side.isClosed) listener();
      else side.closeListeners.push(listener);
    },
    opened: () =>
      new Promise<Carrier>((resolve, reject) => {
        if (side.carrier !== null) return resolve(side.carrier);
        side.waiting.push(resolve);
        side.closeListeners.push(() => reject(new Error("closed before open")));
      }),
  });

  const devicePeers: DirectPeers = {
    open: async ({ stunServers }) => {
      state.stunServers.push(stunServers);
      state.openedDevicePeers += 1;
      const side = makeSide();
      return peerOf(side, {
        accept: async (answer) => {
          const host = state.answered.get(answer);
          if (host === void 0) throw new Error("no such answer");
          if (state.isBlocked) return;
          const [deviceEnd, hostEnd] = fakeCarrierPair();
          state.carriers.push({ device: deviceEnd, host: hostEnd });
          side.carrier = deviceEnd;
          host.carrier = hostEnd;
          deviceEnd.onClose(side.end);
          hostEnd.onClose(host.end);
          for (const resolve of side.waiting.splice(0)) resolve(deviceEnd);
          for (const resolve of host.waiting.splice(0)) resolve(hostEnd);
        },
        answer: async () => {
          throw new Error("a device does not answer");
        },
        offer: async () => {
          state.offers += 1;
          return `offer-${state.offers}`;
        },
      });
    },
  };

  const hostPeers: DirectPeers = {
    open: async ({ stunServers }) => {
      state.stunServers.push(stunServers);
      state.openedHostPeers += 1;
      const side = makeSide();
      return peerOf(side, {
        accept: async () => {
          throw new Error("a host does not accept");
        },
        answer: async (offer) => {
          const answer = `answer-to-${offer}`;
          state.answered.set(answer, side);
          return answer;
        },
        offer: async () => {
          throw new Error("a host does not offer");
        },
      });
    },
  };

  return { devicePeers, hostPeers, state };
};

import type { Carrier } from "./carrier.ts";

// The seam to a WebRTC implementation: a browser's RTCPeerConnection, or werift in Node. The upgrade (directUpgrade.ts)
// only asks a peer for what it needs, so tests drive it with stand-ins and nothing else here is platform code.

/** One side of a direct connection: it makes or takes the description, then yields the open data channel. */
export interface DirectPeer {
  /** The device's side: takes the host's answer. */
  accept(answer: string): Promise<void>;
  /** The host's side: takes the offer and makes the answer, complete with its candidates. */
  answer(offer: string): Promise<string>;
  close(): void;
  /** The device's side: makes the offer, complete with its candidates. */
  offer(): Promise<string>;
  /** Runs when the connection ends, whatever the reason. */
  onClosed(listener: () => void): void;
  /** Resolves with the channel once it is open, and rejects if the connection ends first. */
  opened(): Promise<Carrier>;
}

/** Makes peers; the platform names one, or none where it has no WebRTC. */
export interface DirectPeers {
  /** `gatherMillis` bounds the wait for STUN answers: a description is made with the candidates found by then. */
  open(options: { gatherMillis: number; stunServers: readonly string[] }): Promise<DirectPeer>;
}

// The parts of the W3C API both a browser and werift offer, as far as this needs them. The standard names are used
// as they are; the DOM library is not loaded here, and a Node host has none.

interface RtcDescription {
  readonly sdp: string;
  readonly type: string;
}

interface RtcDataChannel {
  binaryType: string;
  readonly bufferedAmount: number;
  bufferedAmountLowThreshold: number;
  close(): void;
  onclose: ((event: unknown) => void) | null | undefined;
  onerror: ((event: unknown) => void) | null | undefined;
  onmessage: ((event: { data: unknown }) => void) | null | undefined;
  onopen: ((event: unknown) => void) | null | undefined;
  readonly readyState: string;
  send(data: Uint8Array): void;
}

export interface RtcConnection {
  addEventListener(type: string, listener: (event: unknown) => void): void;
  close(): void;
  readonly connectionState: string;
  createAnswer(): Promise<RtcDescription>;
  createDataChannel(label: string, options: { id: number; negotiated: boolean; ordered: boolean }): RtcDataChannel;
  createOffer(): Promise<RtcDescription>;
  readonly iceGatheringState: string;
  readonly localDescription: RtcDescription | null;
  setLocalDescription(description?: RtcDescription): Promise<unknown>;
  setRemoteDescription(description: RtcDescription): Promise<void>;
}

/** The constructor of a connection class: `RTCPeerConnection` in a browser, werift's in Node. */
export type RtcConnectionClass = new (configuration: { iceServers: Array<{ urls: string[] }> }) => RtcConnection;

/** Writes the channel's messages to the carrier's reader as bytes, and drops what is not bytes. */
const bytesOf = (data: unknown): Uint8Array | null =>
  data instanceof Uint8Array
    ? data
    : data instanceof ArrayBuffer
      ? new Uint8Array(data)
      : ArrayBuffer.isView(data)
        ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        : null;

/** How much a channel holds unsent before the carrier keeps messages back, and when it lets them go on. */
const highWater = 1024 * 1024;
const lowWater = 256 * 1024;

/**
 * A data channel as a carrier. Sends wait in a queue while the channel's own buffer is full, so a large message does
 * not make the channel throw, and its end is reported once however it came.
 */
export const dataChannelCarrier = (channel: RtcDataChannel): Carrier => {
  const messages: Array<(data: Uint8Array) => void> = [];
  const closes: Array<() => void> = [];
  const queue: Uint8Array[] = [];
  // What arrives before the first listener waits for it: the other side may speak the moment the channel opens.
  const early: Uint8Array[] = [];
  let isClosed = false;
  channel.binaryType = "arraybuffer";
  channel.bufferedAmountLowThreshold = lowWater;

  const end = () => {
    if (isClosed) return;
    isClosed = true;
    queue.length = 0;
    for (const listener of closes.splice(0)) listener();
  };
  const drain = () => {
    while (!isClosed && queue.length > 0 && channel.bufferedAmount < highWater) {
      const next = queue.shift();
      if (next === void 0) return;
      try {
        channel.send(next);
      } catch {
        channel.close();
        end();
      }
    }
  };
  channel.onmessage = (event) => {
    const data = bytesOf(event.data);
    if (data === null) return;
    if (messages.length === 0) early.push(data);
    else for (const listener of messages) listener(data);
  };
  channel.onclose = end;
  channel.onerror = end;
  // The event is named in the standard way by both implementations; where one does not emit it, `drain` also runs on
  // each send, which is enough for a stream that keeps sending.
  const watcher = channel as unknown as { addEventListener?: (type: string, listener: () => void) => void };
  watcher.addEventListener?.("bufferedamountlow", drain);

  return {
    close: () => {
      if (isClosed) return;
      try {
        channel.close();
      } finally {
        end();
      }
    },
    onClose: (listener) => {
      if (isClosed) listener();
      else closes.push(listener);
    },
    onMessage: (listener) => {
      messages.push(listener);
      for (const data of early.splice(0)) listener(data);
    },
    send: (data) => {
      if (isClosed) throw new Error("the data channel is closed");
      queue.push(data);
      drain();
    },
  };
};

/** Resolves when a connection's gathering of candidates is complete, or after `millis`, whichever is first. */
const gathered = (connection: RtcConnection, millis: number) =>
  new Promise<void>((resolve) => {
    if (connection.iceGatheringState === "complete") {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, millis);
    connection.addEventListener("icegatheringstatechange", () => {
      if (connection.iceGatheringState !== "complete") return;
      clearTimeout(timer);
      resolve();
    });
  });

const descriptionOf = (connection: RtcConnection) => {
  const description = connection.localDescription;
  if (description === null) throw new Error("the connection has no local description");
  return description.sdp;
};

/**
 * Peers over a WebRTC implementation with the W3C names. The data channel is negotiated in advance, id 0, ordered and
 * reliable, so neither side waits for the other to open it. Candidates travel inside the description (no trickle):
 * one offer and one answer cross the relay per try, however many addresses a machine has.
 */
export const rtcPeers = (
  load: () => Promise<RtcConnectionClass>,
  /** Settings of the implementation beyond the standard ones, such as werift's. */
  extra: Record<string, unknown> = {},
): DirectPeers => ({
  open: async ({ gatherMillis, stunServers }) => {
    const Connection = await load();
    const connection = new Connection({
      ...extra,
      iceServers: stunServers.length === 0 ? [] : [{ urls: [...stunServers] }],
    });
    const channel = connection.createDataChannel("outlore", { id: 0, negotiated: true, ordered: true });
    const closeListeners: Array<() => void> = [];
    let isClosed = false;
    const end = () => {
      if (isClosed) return;
      isClosed = true;
      for (const listener of closeListeners.splice(0)) listener();
    };
    connection.addEventListener("connectionstatechange", () => {
      if (["closed", "failed"].includes(connection.connectionState)) end();
    });
    const carrier = dataChannelCarrier(channel);
    carrier.onClose(end);

    return {
      accept: async (answer) => connection.setRemoteDescription({ sdp: answer, type: "answer" }),
      answer: async (offer) => {
        await connection.setRemoteDescription({ sdp: offer, type: "offer" });
        await connection.setLocalDescription(await connection.createAnswer());
        await gathered(connection, gatherMillis);
        return descriptionOf(connection);
      },
      close: () => {
        try {
          carrier.close();
          connection.close();
        } finally {
          end();
        }
      },
      offer: async () => {
        await connection.setLocalDescription(await connection.createOffer());
        await gathered(connection, gatherMillis);
        return descriptionOf(connection);
      },
      onClosed: (listener) => {
        if (isClosed) listener();
        else closeListeners.push(listener);
      },
      opened: () =>
        new Promise<Carrier>((resolve, reject) => {
          if (channel.readyState === "open") return resolve(carrier);
          if (isClosed) return reject(new Error("the connection ended before the channel opened"));
          channel.onopen = () => resolve(carrier);
          closeListeners.push(() => reject(new Error("the connection ended before the channel opened")));
        }),
    };
  },
});

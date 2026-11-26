import { maxMessageBytes, type SecureChannel } from "./secureChannel.ts";

// A paired device's link to its host as the app sees it: one ordered message stream that travels over the relay, and
// over a direct channel once one is up (device-pairing, Direct path). The relay's secure channel stays open beneath it
// as the fallback; a direct secure channel, made by its own Noise handshake, is attached beside it. Nothing here reads
// a message: both channels are already end-to-end encrypted, and a frame is only bytes in front of one.
//
// Frames. Until both sides agree to use them, a message travels as it is, always JSON text starting with `{`; this is
// how a link to a host of an earlier release keeps working. Once they agree, a message is a DATA frame with a sequence
// number, so that the receiver can put messages back in order across the two paths and drop what a replay repeats.

/** Which path messages leave on now. */
export type PathKind = "direct" | "relay";

/** The first byte of a message that is not a frame: every application message is a JSON object. */
export const plainFirstByte = 0x7b;
/** The first byte of a framed message, by what the frame is. */
export const frameKind = { ack: 2, control: 3, data: 1, link: 4 } as const;
/** A DATA frame's bytes before the payload: its kind and its 32-bit sequence number. */
export const dataHeaderBytes = 5;

/** Largest application message a link sends, in bytes: what a secure channel carries, less one frame's header. */
export const maxLinkMessageBytes = maxMessageBytes - dataHeaderBytes;

/** The pacing of a link's direct channel; each is the default of what `PathLinkOptions` overrides. */
export const pathTimings = {
  /** How often a direct channel carries a frame of its own, so that a dead path shows and a NAT mapping stays open. */
  beatMillis: 10_000,
  /** A silent direct channel is given up after this many beats without a frame from the other side. */
  maxSilentBeats: 3,
} as const;

/** Messages received over the direct channel after which the receiver acknowledges. */
export const ackEveryMessages = 16;
/** Bytes received over the direct channel after which the receiver acknowledges. */
export const ackEveryBytes = 256 * 1024;
/** What a sender keeps for replay while the direct channel has not acknowledged it; more than this ends the channel. */
export const maxUnackedBytes = 64 * 1024 * 1024;
/** What a receiver holds while it waits for a message that is late on the other path. */
export const maxEarlyMessages = 4096;

/** Overrides of the direct channel's pacing; each defaults to its `pathTimings` value. */
export type PathLinkOptions = {
  readonly beatMillis?: number;
  readonly maxSilentBeats?: number;
};

/** A secure channel over the relay and, when one is up, over a direct channel too. */
export interface PathLink extends SecureChannel {
  /** Attaches a direct secure channel; messages leave on it once the other side's first frame has arrived on it. */
  attachDirect(channel: SecureChannel): void;
  /** From now on messages travel as sequenced frames, and the other side is told to do the same. */
  enableFrames(): void;
  /** Whether messages travel as sequenced frames. */
  readonly isFramed: boolean;
  /** Runs for each message of the upgrade's own conversation, which only the relay carries. */
  onControl(listener: (text: string) => void): void;
  /** Runs each time the path messages leave on changes. */
  onPath(listener: (path: PathKind) => void): void;
  /** Which path messages leave on now. */
  readonly path: PathKind;
  /** Sends one message of the upgrade's own conversation over the relay, whatever path messages leave on. */
  sendControl(text: string): void;
}

/** A sent frame kept for replay, with its sequence number. */
export type Held = { readonly frame: Uint8Array; readonly seq: number };

/** Builds a DATA frame: its kind, the sequence number, and the payload. */
export const dataFrame = (seq: number, payload: Uint8Array) => {
  const frame = new Uint8Array(dataHeaderBytes + payload.byteLength);
  frame[0] = frameKind.data;
  new DataView(frame.buffer).setUint32(1, seq);
  frame.set(payload, dataHeaderBytes);
  return frame;
};

/** Builds an ACK frame telling the sender the next sequence number expected. */
export const ackFrame = (expected: number) => {
  const frame = new Uint8Array(dataHeaderBytes);
  frame[0] = frameKind.ack;
  new DataView(frame.buffer).setUint32(1, expected);
  return frame;
};

/** Builds a frame of the given kind that carries text. */
export const textFrame = (kind: number, text: string) => {
  const body = new TextEncoder().encode(text);
  const frame = new Uint8Array(1 + body.byteLength);
  frame[0] = kind;
  frame.set(body, 1);
  return frame;
};

/** Reads the sequence number a DATA or ACK frame carries. */
export const numberOf = (frame: Uint8Array) =>
  new DataView(frame.buffer, frame.byteOffset, frame.byteLength).getUint32(1);

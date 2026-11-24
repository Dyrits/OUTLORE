import { Effect, type Fiber } from "effect";
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
const plainFirstByte = 0x7b;
const frameKind = { ack: 2, control: 3, data: 1, link: 4 } as const;
/** A DATA frame's bytes before the payload: its kind and its 32-bit sequence number. */
const dataHeaderBytes = 5;

/** Largest application message a link sends, in bytes: what a secure channel carries, less one frame's header. */
export const maxLinkMessageBytes = maxMessageBytes - dataHeaderBytes;

/** The pacing of a link's direct channel; each is the default of what `PathLinkOptions` overrides. */
export const pathTimings = {
  /** How often a direct channel carries a frame of its own, so that a dead path shows and a NAT mapping stays open. */
  beatMillis: 10_000,
  /** A silent direct channel is given up after this many beats without a frame from the other side. */
  maxSilentBeats: 3,
} as const;

/** What the receiver holds back before it acknowledges, in messages and in bytes. */
const ackEveryMessages = 16;
const ackEveryBytes = 256 * 1024;
/** What a sender keeps for replay while the direct channel has not acknowledged it; more than this ends the channel. */
const maxUnackedBytes = 64 * 1024 * 1024;
/** What a receiver holds while it waits for a message that is late on the other path. */
const maxEarlyMessages = 4096;

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

type Held = { readonly frame: Uint8Array; readonly seq: number };

const dataFrame = (seq: number, payload: Uint8Array) => {
  const frame = new Uint8Array(dataHeaderBytes + payload.byteLength);
  frame[0] = frameKind.data;
  new DataView(frame.buffer).setUint32(1, seq);
  frame.set(payload, dataHeaderBytes);
  return frame;
};

const ackFrame = (expected: number) => {
  const frame = new Uint8Array(dataHeaderBytes);
  frame[0] = frameKind.ack;
  new DataView(frame.buffer).setUint32(1, expected);
  return frame;
};

const textFrame = (kind: number, text: string) => {
  const body = new TextEncoder().encode(text);
  const frame = new Uint8Array(1 + body.byteLength);
  frame[0] = kind;
  frame.set(body, 1);
  return frame;
};

const numberOf = (frame: Uint8Array) => new DataView(frame.buffer, frame.byteOffset, frame.byteLength).getUint32(1);

class Link implements PathLink {
  private readonly messageListeners: Array<(data: Uint8Array) => void> = [];
  private readonly closeListeners: Array<() => void> = [];
  private readonly controlListeners: Array<(text: string) => void> = [];
  private readonly waitingControl: string[] = [];
  private readonly pathListeners: Array<(path: PathKind) => void> = [];
  private readonly waiting: Uint8Array[] = [];
  private waitingBytes = 0;
  private isClosed = false;
  private isRelayOpen = true;
  isFramed = false;
  /** The sequence number of the next message to send. */
  private nextSeq = 0;
  /** The sequence number of the next message to hand to the app. */
  private expected = 0;
  private readonly early = new Map<number, Uint8Array>();
  private direct: SecureChannel | null = null;
  private isDirectConfirmed = false;
  private unacked: Held[] = [];
  private unackedBytes = 0;
  private sinceAckMessages = 0;
  private sinceAckBytes = 0;
  private silentBeats = 0;
  private beating: Fiber.Fiber<void> | null = null;
  private lastPath: PathKind = "relay";

  constructor(
    private readonly relay: SecureChannel,
    private readonly runFork: (effect: Effect.Effect<void>) => Fiber.Fiber<void>,
    private readonly timings: Required<PathLinkOptions>,
  ) {
    relay.onMessage((data) => this.receive(data, "relay"));
    relay.onClose(() => this.relayClosed());
  }

  get path(): PathKind {
    return this.direct !== null && this.isDirectConfirmed ? "direct" : "relay";
  }

  send(plaintext: Uint8Array): void {
    if (plaintext.byteLength > maxLinkMessageBytes) {
      throw new RangeError(`message of ${plaintext.byteLength} bytes exceeds ${maxLinkMessageBytes}`);
    }
    if (this.isClosed) return;
    if (!this.isFramed) {
      this.relay.send(plaintext);
      return;
    }
    const seq = this.nextSeq++;
    const frame = dataFrame(seq, plaintext);
    if (this.direct === null || !this.isDirectConfirmed) {
      this.relay.send(frame);
      return;
    }
    // Kept until the other side says it has them: a direct channel that dies takes what was in flight with it.
    this.unacked.push({ frame, seq });
    this.unackedBytes += frame.byteLength;
    this.direct.send(frame);
    if (this.unackedBytes > maxUnackedBytes) this.dropDirect();
  }

  sendText(text: string): void {
    this.send(new TextEncoder().encode(text));
  }

  sendControl(text: string): void {
    if (this.isClosed || !this.isRelayOpen || !this.isFramed) return;
    this.relay.send(textFrame(frameKind.control, text));
  }

  enableFrames(): void {
    if (this.isFramed || this.isClosed) return;
    // The tell goes out as the last unframed message, so the other side reads everything after it as frames.
    this.relay.send(Uint8Array.of(frameKind.link));
    this.isFramed = true;
  }

  onMessage(listener: (data: Uint8Array) => void): void {
    this.messageListeners.push(listener);
    const early = this.waiting.splice(0);
    this.waitingBytes = 0;
    for (const data of early) listener(data);
  }

  onText(listener: (text: string) => void): void {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    this.onMessage((data) => {
      let text: string;
      try {
        text = decoder.decode(data);
      } catch {
        this.close();
        return;
      }
      listener(text);
    });
  }

  onControl(listener: (text: string) => void): void {
    this.controlListeners.push(listener);
    for (const text of this.waitingControl.splice(0)) listener(text);
  }

  onPath(listener: (path: PathKind) => void): void {
    this.pathListeners.push(listener);
  }

  onClose(listener: () => void): void {
    if (this.isClosed) listener();
    else this.closeListeners.push(listener);
  }

  close(): void {
    if (this.isClosed) return;
    this.end();
    this.relay.close();
  }

  attachDirect(channel: SecureChannel): void {
    if (this.isClosed || !this.isFramed) {
      channel.close();
      return;
    }
    this.dropDirect();
    this.direct = channel;
    this.isDirectConfirmed = false;
    this.silentBeats = 0;
    channel.onMessage((data) => {
      if (this.direct === channel) this.receive(data, "direct");
    });
    channel.onClose(() => {
      if (this.direct === channel) this.dropDirect();
    });
    this.beating = this.runFork(this.beat());
    // The first frame on the path: when the other side's arrives too, both know the channel works both ways.
    channel.send(ackFrame(this.expected));
  }

  /** Reads one message from a path: a frame, or, from the relay only, an unframed application message. */
  private receive(data: Uint8Array, from: PathKind): void {
    if (this.isClosed || data.byteLength === 0) return;
    const kind = data[0];
    if (kind === plainFirstByte) {
      if (from === "relay") this.deliver(data);
      else this.close();
      return;
    }
    if (from === "direct") this.confirm();
    if (kind === frameKind.data && data.byteLength >= dataHeaderBytes) this.receiveData(data, from);
    else if (kind === frameKind.ack && data.byteLength === dataHeaderBytes && from === "direct") this.receiveAck(data);
    else if (kind === frameKind.control && from === "relay") this.receiveControl(data);
    else if (kind === frameKind.link && from === "relay") this.isFramed = true;
    else this.close();
  }

  private receiveData(frame: Uint8Array, from: PathKind): void {
    const seq = numberOf(frame);
    const payload = frame.subarray(dataHeaderBytes);
    if (from === "direct") this.countForAck(frame.byteLength);
    // Below what is expected is a message the sender replayed after it had already got there on the other path.
    if (seq < this.expected) return;
    if (seq > this.expected) {
      if (this.early.size >= maxEarlyMessages) {
        this.close();
        return;
      }
      this.early.set(seq, payload);
      return;
    }
    this.deliver(payload);
    this.expected += 1;
    for (let next = this.early.get(this.expected); next !== void 0; next = this.early.get(this.expected)) {
      this.early.delete(this.expected);
      this.deliver(next);
      this.expected += 1;
    }
  }

  private receiveAck(frame: Uint8Array): void {
    const upTo = numberOf(frame);
    while (this.unacked[0] !== void 0 && this.unacked[0].seq < upTo) {
      const done = this.unacked.shift();
      if (done !== void 0) this.unackedBytes -= done.frame.byteLength;
    }
  }

  private receiveControl(frame: Uint8Array): void {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(frame.subarray(1));
    } catch {
      this.close();
      return;
    }
    // The first listener may come a moment after the device's first offer: what arrives until then waits for it.
    if (this.controlListeners.length === 0) this.waitingControl.push(text);
    else for (const listener of [...this.controlListeners]) listener(text);
  }

  /** A frame from the direct channel: it works that way, and it is alive. */
  private confirm(): void {
    this.silentBeats = 0;
    if (this.direct === null || this.isDirectConfirmed) return;
    this.isDirectConfirmed = true;
    this.notifyPath();
  }

  private countForAck(bytes: number): void {
    this.sinceAckMessages += 1;
    this.sinceAckBytes += bytes;
    if (this.sinceAckMessages >= ackEveryMessages || this.sinceAckBytes >= ackEveryBytes) this.sendAck();
  }

  private sendAck(): void {
    this.sinceAckMessages = 0;
    this.sinceAckBytes = 0;
    this.direct?.send(ackFrame(this.expected));
  }

  /** Sends a frame of its own every beat and gives the channel up when the other side has gone quiet. */
  private beat(): Effect.Effect<void> {
    return Effect.sleep(this.timings.beatMillis).pipe(
      Effect.andThen(
        Effect.sync(() => {
          if (this.direct === null) return false;
          this.silentBeats += 1;
          if (this.silentBeats > this.timings.maxSilentBeats) {
            this.dropDirect();
            return false;
          }
          this.sendAck();
          return true;
        }),
      ),
      Effect.flatMap((isGoing) => (isGoing ? this.beat() : Effect.void)),
    );
  }

  private deliver(message: Uint8Array): void {
    if (this.messageListeners.length > 0) {
      for (const listener of [...this.messageListeners]) listener(message);
      return;
    }
    this.waiting.push(message);
    this.waitingBytes += message.byteLength;
    if (this.waitingBytes > maxMessageBytes) this.close();
  }

  /**
   * The direct channel is gone: what it carried unacknowledged goes again over the relay, in order, and the
   * receiver drops what it had already got. With the relay gone as well there is nothing left to carry the link.
   */
  private dropDirect(): void {
    const direct = this.direct;
    if (direct === null) return;
    this.direct = null;
    this.isDirectConfirmed = false;
    this.stopBeating();
    direct.close();
    if (!this.isRelayOpen) {
      this.end();
      return;
    }
    const replay = this.unacked.splice(0);
    this.unackedBytes = 0;
    for (const held of replay) this.relay.send(held.frame);
    this.notifyPath();
  }

  private relayClosed(): void {
    this.isRelayOpen = false;
    // A direct channel that works carries the link on its own until it ends too.
    if (this.direct !== null && this.isDirectConfirmed && !this.isClosed) return;
    this.end();
  }

  private stopBeating(): void {
    this.beating?.interruptUnsafe();
    this.beating = null;
  }

  private notifyPath(): void {
    const path = this.path;
    if (path === this.lastPath) return;
    this.lastPath = path;
    for (const listener of [...this.pathListeners]) listener(path);
  }

  private end(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    this.stopBeating();
    const direct = this.direct;
    this.direct = null;
    direct?.close();
    this.isDirectConfirmed = false;
    this.unacked = [];
    this.early.clear();
    this.waiting.length = 0;
    this.notifyPath();
    for (const listener of this.closeListeners.splice(0)) listener();
  }
}

/**
 * Makes the link over an open secure channel to the host, which becomes its relay path. It takes over the channel's
 * listeners, so the caller reads messages from the link only. The beat of a direct channel runs in the caller's
 * Effect context, so a test that drives time sees it.
 */
export const makePathLink = Effect.fnUntraced(function* (relay: SecureChannel, options: PathLinkOptions = {}) {
  const context = yield* Effect.context<never>();
  const runFork = Effect.runForkWith(context);
  return new Link(relay, runFork, { ...pathTimings, ...options }) satisfies PathLink;
});

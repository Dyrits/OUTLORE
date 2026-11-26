import { Effect, type Fiber } from "effect";
import {
  ackFrame,
  dataFrame,
  dataHeaderBytes,
  frameKind,
  maxLinkMessageBytes,
  maxUnackedBytes,
  numberOf,
  type PathKind,
  type PathLink,
  type PathLinkOptions,
  pathTimings,
  plainFirstByte,
  textFrame,
} from "./pathFrames.ts";
import { AckCounter, ControlQueue, DeliveryQueue, Reorderer, ReplayBuffer, repeatBeat } from "./pathOrder.ts";
import type { SecureChannel } from "./secureChannel.ts";

class Link implements PathLink {
  private readonly messages = new DeliveryQueue();
  private readonly control = new ControlQueue();
  private readonly closeListeners: Array<() => void> = [];
  private readonly pathListeners: Array<(path: PathKind) => void> = [];
  private isClosed = false;
  private isRelayOpen = true;
  isFramed = false;
  /** The sequence number of the next message to send. */
  private nextSeq = 0;
  private readonly order = new Reorderer();
  private direct: SecureChannel | null = null;
  private isDirectConfirmed = false;
  private readonly unacked = new ReplayBuffer();
  private readonly acks = new AckCounter();
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
    this.unacked.keep({ frame, seq });
    this.direct.send(frame);
    if (this.unacked.bytes > maxUnackedBytes) this.dropDirect();
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
    this.messages.add(listener);
  }

  onText(listener: (text: string) => void): void {
    this.messages.addText(listener, () => this.close());
  }

  onControl(listener: (text: string) => void): void {
    this.control.add(listener);
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
    channel.send(ackFrame(this.order.expected));
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
    else if (kind === frameKind.ack && data.byteLength === dataHeaderBytes && from === "direct")
      this.unacked.acknowledge(numberOf(data));
    else if (kind === frameKind.control && from === "relay") {
      if (!this.control.receive(data)) this.close();
    } else if (kind === frameKind.link && from === "relay") this.isFramed = true;
    else this.close();
  }

  private receiveData(frame: Uint8Array, from: PathKind): void {
    const seq = numberOf(frame);
    const payload = frame.subarray(dataHeaderBytes);
    if (from === "direct" && this.acks.record(frame.byteLength)) this.sendAck();
    if (!this.order.accept(seq, payload, (message) => this.deliver(message))) this.close();
  }

  /** A frame from the direct channel: it works that way, and it is alive. */
  private confirm(): void {
    this.silentBeats = 0;
    if (this.direct === null || this.isDirectConfirmed) return;
    this.isDirectConfirmed = true;
    this.notifyPath();
  }

  private sendAck(): void {
    this.acks.reset();
    this.direct?.send(ackFrame(this.order.expected));
  }

  /** Sends a frame of its own every beat and gives the channel up when the other side has gone quiet. */
  private beat(): Effect.Effect<void> {
    return repeatBeat(this.timings, () => {
      if (this.direct === null) return false;
      this.silentBeats += 1;
      if (this.silentBeats > this.timings.maxSilentBeats) {
        this.dropDirect();
        return false;
      }
      this.sendAck();
      return true;
    });
  }

  private deliver(message: Uint8Array): void {
    if (!this.messages.deliver(message)) this.close();
  }

  /** The direct channel is gone: what it carried unacknowledged goes again over the relay, in order, and the receiver drops what it had already got. With the relay gone as well there is nothing left to carry the link. */
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
    for (const held of this.unacked.drain()) this.relay.send(held.frame);
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
    this.unacked.clear();
    this.order.clear();
    this.messages.clear();
    this.notifyPath();
    for (const listener of this.closeListeners.splice(0)) listener();
  }
}

/** Makes the link over an open secure channel to the host, which becomes its relay path. It takes over the channel's listeners, so the caller reads messages from the link only. The beat of a direct channel runs in the caller's Effect context, so a test that drives time sees it. */
export const makePathLink = Effect.fnUntraced(function* (relay: SecureChannel, options: PathLinkOptions = {}) {
  const context = yield* Effect.context<never>();
  const runFork = Effect.runForkWith(context);
  return new Link(relay, runFork, { ...pathTimings, ...options }) satisfies PathLink;
});

import { Effect } from "effect";
import { ackEveryBytes, ackEveryMessages, type Held, maxEarlyMessages, type PathLinkOptions } from "./pathFrames.ts";
import { maxMessageBytes } from "./secureChannel.ts";

/** Hands messages to the app in sequence however the two paths interleave them, and drops what a replay repeats. */
export class Reorderer {
  private readonly early = new Map<number, Uint8Array>();
  /** The sequence number of the next message to hand to the app. */
  expected = 0;

  /** Delivers `payload` and whatever it unblocks; false when too many messages wait for one that never came. */
  accept(seq: number, payload: Uint8Array, deliver: (message: Uint8Array) => void): boolean {
    // Below what is expected is a message the sender replayed after it had already got there on the other path.
    if (seq < this.expected) return true;
    if (seq > this.expected) {
      if (this.early.size >= maxEarlyMessages) return false;
      this.early.set(seq, payload);
      return true;
    }
    deliver(payload);
    this.expected += 1;
    for (let next = this.early.get(this.expected); next !== void 0; next = this.early.get(this.expected)) {
      this.early.delete(this.expected);
      deliver(next);
      this.expected += 1;
    }
    return true;
  }

  /** Forgets every message that waits for an earlier one. */
  clear(): void {
    this.early.clear();
  }
}

/** What a sender keeps for replay over the relay while the direct channel has not acknowledged it. */
export class ReplayBuffer {
  private held: Held[] = [];
  /** The bytes of every frame kept. */
  bytes = 0;

  /** Keeps a frame until the other side acknowledges it. */
  keep(frame: Held): void {
    this.held.push(frame);
    this.bytes += frame.frame.byteLength;
  }

  /** Lets go of every frame below the sequence number the other side expects next. */
  acknowledge(upTo: number): void {
    while (this.held[0] !== void 0 && this.held[0].seq < upTo) {
      const done = this.held.shift();
      if (done !== void 0) this.bytes -= done.frame.byteLength;
    }
  }

  /** Takes every frame kept, oldest first, to send them again. */
  drain(): Held[] {
    this.bytes = 0;
    return this.held.splice(0);
  }

  /** Forgets every frame kept. */
  clear(): void {
    this.held = [];
    this.bytes = 0;
  }
}

/** Holds application messages that arrive before the first listener registers, bounded by one maximum message. */
export class DeliveryQueue {
  private readonly listeners: Array<(data: Uint8Array) => void> = [];
  private readonly waiting: Uint8Array[] = [];
  private waitingBytes = 0;

  /** Adds a message listener and replays any messages held before the first listener registered. */
  add(listener: (data: Uint8Array) => void): void {
    this.listeners.push(listener);
    const early = this.waiting.splice(0);
    this.waitingBytes = 0;
    for (const data of early) listener(data);
  }

  /** Adds a UTF-8 text listener, invoking `onInvalid` when a received payload is not valid UTF-8. */
  addText(listener: (text: string) => void, onInvalid: () => void): void {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    this.add((data) => {
      try {
        listener(decoder.decode(data));
      } catch {
        onInvalid();
      }
    });
  }

  /** Delivers a message or queues it until a listener registers; returns false when the queue exceeds the byte cap. */
  deliver(message: Uint8Array): boolean {
    if (this.listeners.length > 0) {
      for (const listener of [...this.listeners]) listener(message);
      return true;
    }
    this.waiting.push(message);
    this.waitingBytes += message.byteLength;
    return this.waitingBytes <= maxMessageBytes;
  }

  /** Drops queued messages that have not been delivered. */
  clear(): void {
    this.waiting.length = 0;
    this.waitingBytes = 0;
  }
}

/** Decodes and queues direct-upgrade control messages that arrive before the upgrade listener registers. */
export class ControlQueue {
  private readonly listeners: Array<(text: string) => void> = [];
  private readonly waiting: string[] = [];

  /** Adds a control listener and replays any control messages held before it registered. */
  add(listener: (text: string) => void): void {
    this.listeners.push(listener);
    for (const text of this.waiting.splice(0)) listener(text);
  }

  /** Decodes a control frame as UTF-8 and delivers or queues it; returns false when decoding fails. */
  receive(frame: Uint8Array): boolean {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(frame.subarray(1));
    } catch {
      return false;
    }
    // The first listener may come a moment after the device's first offer: what arrives until then waits for it.
    if (this.listeners.length === 0) this.waiting.push(text);
    else for (const listener of [...this.listeners]) listener(text);
    return true;
  }
}

/** Sleeps `beatMillis` between beats and runs `tick` until it returns false. */
export const repeatBeat = (timings: Required<PathLinkOptions>, tick: () => boolean): Effect.Effect<void> =>
  Effect.sleep(timings.beatMillis).pipe(
    Effect.andThen(Effect.sync(tick)),
    Effect.flatMap((isGoing) => (isGoing ? repeatBeat(timings, tick) : Effect.void)),
  );

/** Counts direct-path frames and bytes since the last acknowledgement and says when another is due. */
export class AckCounter {
  private messages = 0;
  private bytes = 0;

  /** Records one received direct frame and returns true once an acknowledgement should be sent. */
  record(byteLength: number): boolean {
    this.messages += 1;
    this.bytes += byteLength;
    return this.messages >= ackEveryMessages || this.bytes >= ackEveryBytes;
  }

  /** Resets the counters after an acknowledgement goes out. */
  reset(): void {
    this.messages = 0;
    this.bytes = 0;
  }
}

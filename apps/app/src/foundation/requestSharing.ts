import {
  isAffectedBy,
  isQueryTag,
  type RequestTag,
  Results,
  type ServerFrame,
  type ServiceError,
  type Topic,
} from "@outlore/contracts";
import { Schema } from "effect";

/** A request the service refused or failed, carrying its error. */
export class RequestFailed extends Error {
  constructor(readonly error: ServiceError) {
    super(error.message);
  }
}

/** One asker of a request, holding the promise to answer. */
type Waiter = { resolve: (value: unknown) => void; reject: (error: Error) => void };
/** A request sent and not yet answered, with everyone who asked it: equal queries asked together share one. */
type Pending = { tag: RequestTag; waiters: Array<Waiter> };
/** A listener to a committed change, and the read it refetches: it hears only the changes that may alter that read. */
type ChangeListener = { listener: () => void; tag: RequestTag | null };
/** A frame that answers a request this connection sent: its value, or why it failed. */
type AnswerFrame = Extract<ServerFrame, { _tag: "Failure" | "Success" }>;

/**
 * One connection's requests in flight and the changes its screens follow: equal queries asked together share one
 * request, and a listener hears only the changes that may alter the read it refetches.
 */
export class RequestSharing {
  private nextId = 0;
  private readonly pending = new Map<string, Pending>();
  /** The id of the query in flight for each query's text: a query asked again before the next change joins it (idle traffic). */
  private readonly sharedQueries = new Map<string, string>();
  private readonly listeners = new Set<ChangeListener>();

  /** Registers an asker of a request; the id to send it under, or null when it joins an equal query already in flight. */
  enter(tag: RequestTag, key: string | null, waiter: Waiter): string | null {
    // A command may change what a query returns before the next Changed frame: a query asked after it asks again.
    if (key === null) this.sharedQueries.clear();
    const sharedId = key === null ? undefined : this.sharedQueries.get(key);
    const shared = sharedId === undefined ? undefined : this.pending.get(sharedId);
    if (shared !== undefined) {
      shared.waiters.push(waiter);
      return null;
    }
    const id = String(++this.nextId);
    if (key !== null) this.sharedQueries.set(key, id);
    this.pending.set(id, { tag, waiters: [waiter] });
    return id;
  }

  /** Answers a frame to everyone who asked that request, and ends the sharing its answer settles. */
  answer(frame: AnswerFrame) {
    const request = this.pending.get(frame.id);
    if (request === undefined) return;
    this.pending.delete(frame.id);
    // A command's answer means its change is committed, though its Changed frame may wait for the window.
    if (isQueryTag(request.tag)) {
      for (const [key, id] of this.sharedQueries) if (id === frame.id) this.sharedQueries.delete(key);
    } else this.sharedQueries.clear();
    if (frame._tag === "Failure") {
      for (const waiter of request.waiters) waiter.reject(new RequestFailed(frame.error));
      return;
    }
    try {
      const value = Schema.decodeUnknownSync(Results[request.tag] as unknown as Schema.Codec<unknown>)(frame.value);
      for (const waiter of request.waiters) waiter.resolve(value);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      for (const waiter of request.waiters) waiter.reject(failure);
    }
  }

  /** Tells the listeners of a change; a change that names its topics reaches only those whose read may have changed. */
  notify(topics?: ReadonlyArray<Topic>) {
    // A query asked after this change must not take the answer of one asked before it, which may predate it.
    this.sharedQueries.clear();
    for (const { listener, tag } of this.listeners) if (tag === null || isAffectedBy(tag, topics)) listener();
  }

  /** Calls the listener after every committed change and after reconnecting, or, given a read's tag, only for the changes that may alter that read. */
  subscribe(listener: () => void, tag: RequestTag | null = null) {
    const subscription = { listener, tag };
    this.listeners.add(subscription);
    return () => this.listeners.delete(subscription);
  }

  /** Rejects every request in flight with the message, as when the connection closes, so no asker waits forever. */
  end(message: string) {
    for (const request of this.pending.values()) {
      for (const waiter of request.waiters) waiter.reject(new Error(message));
    }
    this.pending.clear();
    this.sharedQueries.clear();
  }
}

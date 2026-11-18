import {
  type Request,
  type RequestTag,
  type ResultOf,
  Results,
  ServerFrameJson,
  type ServiceError,
} from "@outlore/contracts";
import { Schema } from "effect";
import type { DesktopBridge } from "./desktopBridge";
import { advanceHostLink, initialHostLink } from "./hostStatus";
import { hostEndpointOf, linkFailureOf, retryDelayOf } from "./hosts";
import { type OpenTransport, socketTransport, type Transport } from "./transport";

declare global {
  interface Window {
    outlore?: DesktopBridge;
  }
}

const decodeFrame = Schema.decodeUnknownSync(ServerFrameJson);

/** A request the service refused or failed, carrying its error. */
export class RequestFailed extends Error {
  constructor(readonly error: ServiceError) {
    super(error.message);
  }
}

type Pending = { tag: RequestTag; resolve: (value: unknown) => void; reject: (error: Error) => void };

/** One connection to the local service, or through it to a paired host: requests with replies, and change announcements. */
export class ServiceClient {
  private socket: Transport | null = null;
  /** The transport still connecting, so that closing the client can end it. */
  private attempt: Transport | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private nextId = 0;
  private link = initialHostLink;
  private readonly pending = new Map<string, Pending>();
  private readonly listeners = new Set<() => void>();
  private readonly draftListeners = new Set<(threadId: string, text: string) => void>();
  private readonly failureListeners = new Set<() => void>();

  private constructor(
    private readonly openTransport: OpenTransport,
    /** The paired host this connection leads to; null for the local service. */
    readonly hostId: string | null,
  ) {}

  /**
   * Connects to the local service, or to a paired host's service through it. `isForUpdate` connects to a host of another
   * release, for the two requests that update it (app-updates).
   */
  static async connect(hostId: string | null = null, isForUpdate = false): Promise<ServiceClient> {
    if (window.outlore === undefined) return Promise.reject(new Error("Open Outlore through the desktop app."));
    const endpoint = await window.outlore.endpoint();
    return ServiceClient.connectThrough(
      socketTransport(hostId === null ? endpoint : hostEndpointOf(endpoint, hostId, isForUpdate)),
      hostId,
    );
  }

  /** Connects through a transport, as a browser does to a host it paired with (`hostId` names that host). */
  static async connectThrough(openTransport: OpenTransport, hostId: string | null): Promise<ServiceClient> {
    const client = new ServiceClient(openTransport, hostId);
    await client.open();
    return client;
  }

  /** Whether this client has ever reached the selected service. */
  get hasConnected() {
    return this.link.hasConnected;
  }

  /** Why the link to the host is down, in the words the owner reads; null while it works or on the local service. */
  get failure() {
    return this.link.failure;
  }

  /** Whether the link stopped trying for good: the host refused this installation, so only pairing again helps. */
  get hasGivenUp() {
    return this.link.hasGivenUp;
  }

  /** Whether the host refused this installation, so only pairing again helps (not a host of another release). */
  get needsPairing() {
    return this.link.needsPairing;
  }

  /** Whether the host refused the app because it runs a different release. */
  get hasReleaseMismatch() {
    return this.link.hasReleaseMismatch;
  }

  /** Calls the listener when the link's failure appears or clears. */
  subscribeFailure(listener: () => void) {
    this.failureListeners.add(listener);
    return () => this.failureListeners.delete(listener);
  }

  private setFailure(next: string | null) {
    if (next === this.link.failure) return;
    this.link = advanceHostLink(this.link, { message: next, type: "failure" });
    for (const listener of this.failureListeners) listener();
  }

  /** Ends the connection for good, as when the window shows another host. */
  close() {
    this.link = advanceHostLink(this.link, { type: "end" });
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.attempt?.close();
    this.socket?.close();
  }

  /** Opens a transport, exposing a failed first attempt as a retrying client so the window can cancel or recover it. */
  private open() {
    return new Promise<void>((resolve) => {
      let socket: Transport | null = null;
      const transport = this.openTransport({
        onClose: (code, reason) => {
          if (this.attempt === socket) this.attempt = null;
          const failure = linkFailureOf(code, reason);
          if (failure !== null) this.setFailure(failure);
          this.link = advanceHostLink(this.link, { code, type: "close" });
          for (const listener of this.failureListeners) listener();
          for (const request of this.pending.values()) {
            request.reject(new Error(failure ?? "The connection to the service closed."));
          }
          this.pending.clear();
          resolve();
          if (this.link.hasGivenUp) return;
          if (this.socket === socket) this.socket = null;
          this.retryTimer = setTimeout(
            () => {
              this.retryTimer = null;
              if (!this.link.hasGivenUp) this.open().catch(() => void 0);
            },
            retryDelayOf(this.link.failures, this.hostId !== null),
          );
        },
        onError: () => {
          this.setFailure(
            this.hostId === null ? "Could not reach this computer's service." : "Could not reach the host.",
          );
          resolve();
        },
        onOpen: () => {
          this.link = advanceHostLink(this.link, { type: "open" });
          if (this.attempt === socket) this.attempt = null;
          if (this.link.hasGivenUp) return socket?.close();
          this.socket = socket;
          this.setFailure(null);
          resolve();
          this.notify();
        },
        onText: (data) => {
          this.link = advanceHostLink(this.link, { type: "message" });
          this.setFailure(null);
          this.receive(data);
        },
      });
      socket = transport;
      this.attempt = transport;
    });
  }

  private receive(data: unknown) {
    const frame = decodeFrame(data);
    if (frame._tag === "Changed") return this.notify();
    if (frame._tag === "Draft") {
      for (const listener of this.draftListeners) listener(frame.threadId, frame.text);
      return;
    }
    const request = this.pending.get(frame.id);
    if (request === undefined) return;
    this.pending.delete(frame.id);
    if (frame._tag === "Failure") return request.reject(new RequestFailed(frame.error));
    try {
      request.resolve(Schema.decodeUnknownSync(Results[request.tag] as unknown as Schema.Codec<unknown>)(frame.value));
    } catch (error) {
      request.reject(error as Error);
    }
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  /** Calls the listener after every committed change and after reconnecting. */
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Calls the listener with each thread's reply in progress; empty text ends it. */
  subscribeDrafts(listener: (threadId: string, text: string) => void) {
    this.draftListeners.add(listener);
    return () => this.draftListeners.delete(listener);
  }

  request<R extends Request>(request: R): Promise<ResultOf<R["_tag"]>> {
    const socket = this.socket;
    if (socket === null || !socket.isOpen) {
      return Promise.reject(
        new Error(this.hostId === null ? "Not connected to this computer’s service." : "Not connected to the host."),
      );
    }
    const id = String(++this.nextId);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve: resolve as (value: unknown) => void, tag: request._tag });
      socket.send(JSON.stringify({ id, request }));
    });
  }
}

/** A fresh request identifier; repeating a command with it returns the original outcome. */
export const newRequestId = () => crypto.randomUUID();

/** The words to show for a failure caught from a request: an error's message, or whatever was thrown, as text. */
export const messageOf = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

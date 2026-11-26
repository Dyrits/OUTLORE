import {
  ClientFrameJson,
  draftAfter,
  isQueryTag,
  type Request,
  type RequestTag,
  type ResultOf,
  ServerFrameJson,
  type TerminalData,
  type TerminalExit,
} from "@outlore/contracts";
import { Schema } from "effect";
import type { DesktopBridge } from "./desktopBridge";
import { advanceHostLink, initialHostLink } from "./hostStatus";
import { hostEndpointOf, linkFailureOf, retryDelayOf } from "./hosts";
import { RequestSharing } from "./requestSharing";
import { type OpenTransport, socketTransport, type Transport } from "./transport";

export { RequestFailed } from "./requestSharing";

declare global {
  interface Window {
    outlore?: DesktopBridge;
  }
}

const decodeFrame = Schema.decodeUnknownSync(ServerFrameJson);

/** One connection to the local service, or through it to a paired host: requests with replies, and change announcements. */
export class ServiceClient {
  private socket: Transport | null = null;
  /** The transport still connecting, so that closing the client can end it. */
  private attempt: Transport | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private link = initialHostLink;
  /** The requests in flight and the changes' listeners, with equal queries shared so each runs once (idle traffic). */
  private readonly sharing = new RequestSharing();
  /** The reply each thread is writing, as far as this connection has been told: appended frames continue it. */
  private readonly drafts = new Map<string, string>();
  private readonly draftListeners = new Set<(threadId: string, text: string) => void>();
  private readonly terminalListeners = new Set<(frame: TerminalData | TerminalExit) => void>();
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
  get isPairingNeeded() {
    return this.link.isPairingNeeded;
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
          // What a dropped link was told of replies in progress is not carried over: the next link starts with the text so far.
          for (const threadId of this.drafts.keys()) for (const listener of this.draftListeners) listener(threadId, "");
          this.drafts.clear();
          const failure = linkFailureOf(code, reason);
          if (failure !== null) this.setFailure(failure);
          this.link = advanceHostLink(this.link, { code, type: "close" });
          for (const listener of this.failureListeners) listener();
          this.sharing.end(failure ?? "The connection to the service closed.");
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
          this.sharing.notify();
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
    if (frame._tag === "Changed") return this.sharing.notify(frame.topics);
    if (frame._tag === "Draft") {
      // A frame that continues text this connection does not hold is a missed one: the whole text comes again soon.
      const text = draftAfter(this.drafts.get(frame.threadId) ?? "", frame);
      if (text === null) return;
      if (text === "") this.drafts.delete(frame.threadId);
      else this.drafts.set(frame.threadId, text);
      for (const listener of this.draftListeners) listener(frame.threadId, text);
      return;
    }
    if (frame._tag === "TerminalData" || frame._tag === "TerminalExit") {
      for (const listener of this.terminalListeners) listener(frame);
      return;
    }
    // A call for the phone is run by the phone app's executor (phone-control); a screen that is not that phone ignores it.
    if (frame._tag === "PhoneCall") return;
    this.sharing.answer(frame);
  }

  /**
   * Calls the listener after every committed change and after reconnecting.
   * Given the tag of the read it refetches, it hears only the changes that may alter that read.
   */
  subscribe(listener: () => void, tag: RequestTag | null = null) {
    return this.sharing.subscribe(listener, tag);
  }

  /** The reply a thread is writing as far as this connection has been told; empty when it writes none. */
  draftOf(threadId: string) {
    return this.drafts.get(threadId) ?? "";
  }

  /** Calls the listener with each thread's reply in progress, whole each time; empty text ends it. */
  subscribeDrafts(listener: (threadId: string, text: string) => void) {
    this.draftListeners.add(listener);
    return () => this.draftListeners.delete(listener);
  }

  /** Calls the listener with each open shell's output and exit, whichever screen it runs on. */
  subscribeTerminals(listener: (frame: TerminalData | TerminalExit) => void) {
    this.terminalListeners.add(listener);
    return () => this.terminalListeners.delete(listener);
  }

  request<R extends Request>(request: R): Promise<ResultOf<R["_tag"]>> {
    const socket = this.socket;
    if (socket === null || !socket.isOpen) {
      return Promise.reject(
        new Error(this.hostId === null ? "Not connected to this computer’s service." : "Not connected to the host."),
      );
    }
    const key = isQueryTag(request._tag) ? JSON.stringify(request) : null;
    return new Promise((resolve, reject) => {
      const waiter = { reject, resolve: resolve as (value: unknown) => void };
      const id = this.sharing.enter(request._tag, key, waiter);
      // Encoded through the frame codec, not plain JSON: a Redacted field (a Vault secret) then travels as what was
      // typed, for the service's decoder to wrap again, instead of as its "<redacted>" placeholder.
      if (id !== null) socket.send(Schema.encodeSync(ClientFrameJson)({ id, request }));
    });
  }
}

/** A fresh request identifier; repeating a command with it returns the original outcome. */
export const newRequestId = () => crypto.randomUUID();

/** The words to show for a failure caught from a request: an error's message, or whatever was thrown, as text. */
export const messageOf = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

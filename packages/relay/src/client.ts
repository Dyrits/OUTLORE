import type { Carrier } from "@outlore/channel";
import { encodeBase64Url } from "@outlore/channel/base64url";
import { Effect, Schema } from "effect";
import { clientIdBytes, hostFrame, readClosingFrame, relayFrame } from "./roomCore.ts";

// The relay as its users see it: a host keeps one connection and hears from its clients by their identifiers; a client
// (a paired device) has one connection that carries its own frames only. Isomorphic: the standard WebSocket only.

/** Whole messages between two peers, in order; the shape the secure channel asks of any carrier. */
export type RelayCarrier = Carrier;

export class ConnectFailure extends Schema.TaggedError<ConnectFailure>()("ConnectFailure", {
  kind: Schema.Literal("unreachable"),
}) {}

/** A text frame the relay answers without waking its room: it keeps a path through a mobile network or a NAT open. */
const keepAliveMillis = 25_000;

const socketUrl = (relayOrigin: string, room: string, query: Record<string, string>) => {
  const url = new URL(`/r/${room}`, relayOrigin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  return url.toString();
};

/** Opens the socket; an attempt that is interrupted before it opens is abandoned. */
const open = (url: string) =>
  Effect.callback<WebSocket, ConnectFailure>((resume) => {
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      resume(Effect.fail(new ConnectFailure({ kind: "unreachable" })));
      return;
    }
    socket.binaryType = "arraybuffer";
    socket.addEventListener("open", () => resume(Effect.succeed(socket)), { once: true });
    socket.addEventListener("error", () => resume(Effect.fail(new ConnectFailure({ kind: "unreachable" }))), {
      once: true,
    });
    return Effect.sync(() => {
      if (socket.readyState !== WebSocket.OPEN) socket.close();
    });
  });

const bytesOf = (data: unknown): Uint8Array | null =>
  data instanceof ArrayBuffer
    ? new Uint8Array(data)
    : ArrayBuffer.isView(data)
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : null;

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const unhex = (text: string) => Uint8Array.from(text.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
/** Pings the relay at a fixed interval until the socket closes. */
const keepAlive = (socket: WebSocket) =>
  Effect.sync(() => {
    if (socket.readyState === WebSocket.OPEN) socket.send("ping");
  }).pipe(
    Effect.delay(keepAliveMillis),
    Effect.forever,
    Effect.raceFirst(
      Effect.callback<void>((resume) => {
        socket.addEventListener("close", () => resume(Effect.void), { once: true });
      }),
    ),
  );

/** A host's connection to its room. */
export interface HostConnection {
  /** Ends the connection; every client of the room is closed by the relay. */
  close(): void;
  /** Closes one client's connection. */
  closeClient(clientId: string): void;
  /** Runs when a client's frame arrives. */
  onClientData(listener: (clientId: string, data: Uint8Array) => void): void;
  /** Runs when a client connects to the room. */
  onClientJoined(listener: (clientId: string) => void): void;
  /** Runs when a client leaves. */
  onClientLeft(listener: (clientId: string) => void): void;
  /** Runs once when the connection ends, with the relay's close code (1006 when it dropped without one). */
  onClose(listener: (code: number, reason: string) => void): void;
  sendToClient(clientId: string, data: Uint8Array): void;
}

/** The host's side of an open socket. */
const hostConnectionOf = (socket: WebSocket): HostConnection => {
  const joined: Array<(clientId: string) => void> = [];
  const left: Array<(clientId: string) => void> = [];
  const data: Array<(clientId: string, data: Uint8Array) => void> = [];
  const closed: Array<(code: number, reason: string) => void> = [];
  let ended: { code: number; reason: string } | null = null;

  // The relay's closing frame says why it is about to close; acting on it does not wait for the close itself.
  const end = (code: number, reason: string) => {
    if (ended !== null) return;
    ended = { code, reason };
    for (const listener of closed) listener(code, reason);
  };

  socket.addEventListener("message", (event) => {
    if (typeof event.data === "string") {
      const closing = readClosingFrame(event.data);
      if (closing !== null) {
        end(closing.code, closing.reason);
        socket.close();
      }
      return;
    }
    const frame = bytesOf(event.data);
    if (frame === null || frame.length < 1 + clientIdBytes) return;
    const clientId = hex(frame.subarray(1, 1 + clientIdBytes));
    if (frame[0] === relayFrame.forward)
      for (const listener of data) listener(clientId, frame.subarray(1 + clientIdBytes));
    else if (frame[0] === relayFrame.joined) for (const listener of joined) listener(clientId);
    else if (frame[0] === relayFrame.left) for (const listener of left) listener(clientId);
  });
  socket.addEventListener("close", (event) => end(event.code, event.reason));

  const framed = (type: number, clientId: string, payload: Uint8Array) => {
    const frame = new Uint8Array(1 + clientIdBytes + payload.length);
    frame[0] = type;
    frame.set(unhex(clientId), 1);
    frame.set(payload, 1 + clientIdBytes);
    return frame;
  };
  const send = (frame: Uint8Array) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(frame);
  };

  return {
    close: () => socket.close(1000, "host closed"),
    closeClient: (clientId) => send(framed(hostFrame.disconnect, clientId, new Uint8Array(0))),
    onClientData: (listener) => void data.push(listener),
    onClientJoined: (listener) => void joined.push(listener),
    onClientLeft: (listener) => void left.push(listener),
    onClose: (listener) => {
      if (ended !== null) listener(ended.code, ended.reason);
      else closed.push(listener);
    },
    sendToClient: (clientId, payload) => send(framed(hostFrame.forward, clientId, payload)),
  };
};

/** A client's connection: the carrier for a secure channel, and why the relay closed it, if it did. */
export interface ClientConnection {
  readonly carrier: RelayCarrier;
  /** The relay's close code once the connection ended; null while it is open. */
  closeCode(): number | null;
}

/** The client's side of an open socket. */
const clientConnectionOf = (socket: WebSocket): ClientConnection => {
  const messages: Array<(data: Uint8Array) => void> = [];
  const closed: Array<() => void> = [];
  const early: Uint8Array[] = [];
  let code: number | null = null;

  // The relay's closing frame says why it is about to close; acting on it does not wait for the close itself.
  const end = (endCode: number) => {
    if (code !== null) return;
    code = endCode;
    for (const listener of closed) listener();
  };

  socket.addEventListener("message", (event) => {
    if (typeof event.data === "string") {
      const closing = readClosingFrame(event.data);
      if (closing !== null) {
        end(closing.code);
        socket.close();
      }
      return;
    }
    const frame = bytesOf(event.data);
    if (frame === null) return;
    if (messages.length === 0) early.push(frame);
    else for (const listener of messages) listener(frame);
  });
  socket.addEventListener("close", (event) => end(event.code));

  return {
    carrier: {
      close: () => socket.close(1000, "client closed"),
      onClose: (listener) => {
        if (code !== null) listener();
        else closed.push(listener);
      },
      onMessage: (listener) => {
        messages.push(listener);
        for (const frame of early.splice(0)) listener(frame);
      },
      send: (frame) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(frame);
      },
    },
    closeCode: () => code,
  };
};

/**
 * Connects as the host of `room`, claiming it with `claim` (the first claim keeps the room); an unreachable relay is
 * the typed failure. The keep-alive runs until the socket closes.
 */
export const connectHost = Effect.fnUntraced(function* (options: {
  claim: Uint8Array;
  relayOrigin: string;
  room: string;
}) {
  const socket = yield* open(
    socketUrl(options.relayOrigin, options.room, { claim: encodeBase64Url(options.claim), role: "host" }),
  );
  yield* Effect.forkDetach(keepAlive(socket));
  return hostConnectionOf(socket);
});

/**
 * Connects to the host of `room` as a client; the relay closes it with `closeCodes.hostOffline` if no host is there.
 * An unreachable relay is the typed failure. The keep-alive runs until the socket closes.
 */
export const connectClient = Effect.fnUntraced(function* (options: { relayOrigin: string; room: string }) {
  const socket = yield* open(socketUrl(options.relayOrigin, options.room, { role: "client" }));
  yield* Effect.forkDetach(keepAlive(socket));
  return clientConnectionOf(socket);
});

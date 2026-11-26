/** What the core needs from one connection, whatever carries it (a `ws` socket, a Durable Object WebSocket, a fake). */
export type RoomPeer = {
  close(code: number, reason: string): void;
  send(data: string | Uint8Array): void;
};

/** Why a connection is closed at once. */
export type Rejection = { readonly code: number; readonly reason: string };

/** The caps of a room. */
export type RoomLimits = {
  /** The most frames a connection may send at once: the budget it starts with and refills up to. */
  readonly frameBurst: number;
  /** The most clients a room holds. */
  readonly maxClients: number;
  /** The largest frame in bytes, counting the 9 byte prefix a client's frame gets on its way to the host. */
  readonly maxFrameBytes: number;
  /** How many frames a connection may send each second on average, which is how fast its budget refills. */
  readonly maxFramesPerSecond: number;
};

/** The default caps: 8 clients, 1 MiB frames, and a budget of 200 frames a second with a burst of 400 for each connection (Cloudflare's soft limit for one object is 1,000 requests a second). */
export const defaultRoomLimits = {
  frameBurst: 400,
  maxClients: 8,
  maxFrameBytes: 1024 * 1024,
  maxFramesPerSecond: 200,
} as const satisfies RoomLimits;

/** The first byte of a binary frame the relay sends to a host: a client's frame, a client joined, a client left. */
export const relayFrame = { forward: 1, joined: 2, left: 3 } as const;

/** The first byte of a binary frame a host sends to the relay: a frame for one client, or close that client. */
export const hostFrame = { disconnect: 2, forward: 1 } as const;

/** The length of a client id in bytes. */
export const clientIdBytes = 8;

/** The length of the prefix of a forwarded frame: its kind byte, then the client id. */
export const prefixBytes = 1 + clientIdBytes;

/**
 * The WebSocket close codes the relay answers with, and so what a host or a client learns about why it was turned
 * away: another host holds the room, no host is there, the host left, a newer host replaced it, or it broke a rule.
 */
export const closeCodes = {
  claimMismatch: 1008,
  frameTooLarge: 1009,
  hostLeft: 1001,
  hostOffline: 1013,
  malformedFrame: 1002,
  normal: 1000,
  rateLimited: 4029,
  replaced: 1012,
  roomFull: 4004,
  textNotSupported: 1003,
} as const;

/** A frame for the other side of the room: its kind, a client id, then the payload untouched. */
export const withPrefix = (type: number, id: Uint8Array, payload: Uint8Array | null): Uint8Array => {
  const frame = new Uint8Array(prefixBytes + (payload?.length ?? 0));
  frame[0] = type;
  frame.set(id, 1);
  if (payload !== null) frame.set(payload, prefixBytes);
  return frame;
};

// A peer that is already closing may refuse a send or a close; the room has nothing more to do about it.
/** Runs an action whose failure the caller has nothing to do about. */
export const attempt = (action: () => void): void => {
  try {
    action();
  } catch {
    // ignored on purpose
  }
};

/**
 * The text frame the relay sends just before it closes a connection for a reason of its own. A client reads why from
 * it at once, where the close itself can reach it late: Node's own WebSocket waits about ten seconds for the
 * connection to end after a close. The words are the close's own code and reason, which the relay would send anyway.
 */
export const closingFrame = (code: number, reason: string): string => JSON.stringify({ closing: { code, reason } });

/** The code and reason in a closing frame, or null when the text is anything else (a pong, say, or garbage). */
export const readClosingFrame = (text: string): Rejection | null => {
  if (!text.startsWith("{")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || !Object.hasOwn(parsed, "closing")) return null;
  // Reflect.get reads the own property just checked and yields an unchecked value to narrow, with no assertion.
  const closing: unknown = Reflect.get(parsed, "closing");
  if (
    typeof closing !== "object" ||
    closing === null ||
    !Object.hasOwn(closing, "code") ||
    !Object.hasOwn(closing, "reason")
  )
    return null;
  const code: unknown = Reflect.get(closing, "code");
  const reason: unknown = Reflect.get(closing, "reason");
  if (typeof code !== "number" || !Number.isInteger(code) || code < 1000 || code > 4999) return null;
  return typeof reason === "string" ? { code, reason } : null;
};

/** Closes a connection after telling it why, in a frame it can read before the close; neither step may throw. */
export const closeWithReason = (peer: RoomPeer, code: number, reason: string): void => {
  attempt(() => peer.send(closingFrame(code, reason)));
  attempt(() => peer.close(code, reason));
};

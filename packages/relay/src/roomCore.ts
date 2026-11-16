import { constantTimeEqual } from "@outlore/channel/constantTimeEqual";
import { Effect, Semaphore } from "effect";
import type { Role } from "./route.ts";

/** What the core needs from one connection, whatever carries it (a `ws` socket, a Durable Object WebSocket, a fake). */
export type RoomPeer = {
  close(code: number, reason: string): void;
  send(data: string | Uint8Array): void;
};

/** A connection the room has accepted, with the identity the room gave it. */
export type Member<P> =
  | { readonly id: Uint8Array; readonly peer: P; readonly role: "client" }
  | { readonly peer: P; readonly role: "host" };

/**
 * Where a room keeps its state. The host claim lives in storage, and who is connected lives with the connections
 * themselves (in a Durable Object, their tags and attachments), so a room survives losing its memory.
 */
export type RoomPorts<P> = {
  /** Records a connection as a member of the room. */
  enroll(member: Member<P>): void;
  /** The accepted connections that are still members. */
  members(): readonly Member<P>[];
  /** The membership of one connection, or null when it was never accepted or has been removed. */
  memberOf(peer: P): Member<P> | null;
  /** The SHA-256 of the claim of the host that first took the room, or null when none has. A storage failure is a defect. */
  readClaim(): Effect.Effect<Uint8Array | null>;
  /** Removes a connection from the room's members. */
  retire(peer: P): void;
  /** Stores the SHA-256 of the claim of the host that first took the room. A storage failure is a defect. */
  writeClaim(hash: Uint8Array): Effect.Effect<void>;
};

/** The caps of a room. */
export type RoomLimits = {
  /** The largest frame in bytes, counting the 9 byte prefix a client's frame gets on its way to the host. */
  readonly maxFrameBytes: number;
  /** The most clients a room holds. */
  readonly maxClients: number;
};

/** Why a connection is closed at once. */
export type Rejection = { readonly code: number; readonly reason: string };

/** The default caps: 8 clients and 1 MiB frames. */
export const defaultRoomLimits = { maxClients: 8, maxFrameBytes: 1024 * 1024 } as const satisfies RoomLimits;

/** The first byte of a binary frame the relay sends to a host: a client's frame, a client joined, a client left. */
export const relayFrame = { forward: 1, joined: 2, left: 3 } as const;

/** The first byte of a binary frame a host sends to the relay: a frame for one client, or close that client. */
export const hostFrame = { disconnect: 2, forward: 1 } as const;

/** The length of a client id in bytes. */
export const clientIdBytes = 8;

const prefixBytes = 1 + clientIdBytes;
const hostFrameTypes: ReadonlySet<number> = new Set(Object.values(hostFrame));

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
  replaced: 1012,
  roomFull: 4004,
  textNotSupported: 1003,
} as const;

const claimMismatch = { code: closeCodes.claimMismatch, reason: "claim mismatch" } as const satisfies Rejection;

const sha256 = (bytes: Uint8Array) =>
  Effect.promise(async () => new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes))));

const withPrefix = (type: number, id: Uint8Array, payload: Uint8Array | null): Uint8Array => {
  const frame = new Uint8Array(prefixBytes + (payload?.length ?? 0));
  frame[0] = type;
  frame.set(id, 1);
  if (payload !== null) frame.set(payload, prefixBytes);
  return frame;
};

// A peer that is already closing may refuse a send or a close; the room has nothing more to do about it.
const attempt = (action: () => void): void => {
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
  if (typeof parsed !== "object" || parsed === null || !("closing" in parsed)) return null;
  const closing = parsed.closing;
  if (typeof closing !== "object" || closing === null || !("code" in closing) || !("reason" in closing)) return null;
  const { code, reason } = closing;
  if (typeof code !== "number" || !Number.isInteger(code) || code < 1000 || code > 4999) return null;
  return typeof reason === "string" ? { code, reason } : null;
};

/** Closes a connection after telling it why, in a frame it can read before the close; neither step may throw. */
export const closeWithReason = (peer: RoomPeer, code: number, reason: string): void => {
  attempt(() => peer.send(closingFrame(code, reason)));
  attempt(() => peer.close(code, reason));
};

/**
 * The rules of one room: who may be its host, who may join, and what is forwarded to whom. A frame is passed on
 * untouched and never read, logged, stored or queued. The core holds no connection state of its own. Each operation
 * is an Effect to run once per call (an event of a connection): the core starts no fiber and no timer, so a room that
 * hibernates between events loses nothing.
 */
export class RoomCore<P extends RoomPeer> {
  readonly #limits: RoomLimits;
  readonly #ports: RoomPorts<P>;
  // Serializes claim checks, so two first hosts arriving together cannot both take the room.
  readonly #claims = Semaphore.makeUnsafe(1);
  #forwarded = 0;

  constructor(ports: RoomPorts<P>, limits: Partial<RoomLimits> = {}) {
    this.#ports = ports;
    this.#limits = { ...defaultRoomLimits, ...limits };
  }

  /** How many frames this core instance has passed on; kept in memory only, so it restarts when the object does. */
  get framesForwarded(): number {
    return this.#forwarded;
  }

  /**
   * Checks a connection before it is accepted: the first host's claim is stored, and every later host must present
   * the same one. Returns null to accept, or why to close the connection at once.
   */
  screen(role: Role, claim: Uint8Array | null): Effect.Effect<Rejection | null> {
    return role === "client" ? Effect.succeed(null) : this.#claims.withPermits(1)(this.#checkClaim(claim));
  }

  /**
   * Takes in a connection that passed `screen` and is now accepted by the transport. A new host replaces the old
   * one and ends its clients; a client is closed at once when there is no host or no room.
   */
  open(peer: P, role: Role): Effect.Effect<void> {
    return Effect.sync(() => (role === "host" ? this.#openHost(peer) : this.#openClient(peer)));
  }

  /** Handles one frame from a connection. */
  receive(peer: P, data: string | Uint8Array): Effect.Effect<void> {
    return Effect.sync(() => this.#receive(peer, data));
  }

  /** Handles the end of a connection, however it ended. */
  close(peer: P): Effect.Effect<void> {
    return Effect.sync(() => {
      const member = this.#ports.memberOf(peer);
      if (member !== null) this.#leave(member);
    });
  }

  #receive(peer: P, data: string | Uint8Array): void {
    const member = this.#ports.memberOf(peer);
    if (member === null) return;
    if (typeof data === "string") {
      if (data === "ping") attempt(() => peer.send("pong"));
      else this.#drop(member, closeCodes.textNotSupported, "text frames are not supported");
      return;
    }
    if (data.byteLength > this.#limits.maxFrameBytes) {
      this.#drop(member, closeCodes.frameTooLarge, "frame too large");
      return;
    }
    if (member.role === "client") this.#receiveFromClient(member, data);
    else this.#receiveFromHost(member, data);
  }

  #checkClaim(claim: Uint8Array | null): Effect.Effect<Rejection | null> {
    if (claim === null) return Effect.succeed(claimMismatch);
    const ports = this.#ports;
    return Effect.gen(function* () {
      const hash = yield* sha256(claim);
      const stored = yield* ports.readClaim();
      if (stored === null) {
        yield* ports.writeClaim(hash);
        return null;
      }
      return constantTimeEqual(stored, hash) ? null : claimMismatch;
    });
  }

  #hostOf(): (Member<P> & { role: "host" }) | null {
    for (const member of this.#ports.members()) if (member.role === "host") return member;
    return null;
  }

  #clients(): (Member<P> & { role: "client" })[] {
    return this.#ports.members().filter((member) => member.role === "client");
  }

  #openHost(peer: P): void {
    const old = this.#hostOf();
    if (old !== null) {
      this.#ports.retire(old.peer);
      closeWithReason(old.peer, closeCodes.replaced, "replaced");
      this.#endClients();
    }
    this.#ports.enroll({ peer, role: "host" });
  }

  #openClient(peer: P): void {
    if (this.#hostOf() === null) {
      closeWithReason(peer, closeCodes.hostOffline, "host offline");
      return;
    }
    const clients = this.#clients();
    if (clients.length >= this.#limits.maxClients) {
      closeWithReason(peer, closeCodes.roomFull, "room full");
      return;
    }
    const id = crypto.getRandomValues(new Uint8Array(clientIdBytes));
    // An id that is already taken is vanishingly rare, but a duplicate would cross two clients' traffic.
    if (clients.some((client) => constantTimeEqual(client.id, id))) {
      this.#openClient(peer);
      return;
    }
    this.#ports.enroll({ id, peer, role: "client" });
    this.#tellHost(relayFrame.joined, id);
  }

  #tellHost(type: number, id: Uint8Array): void {
    const host = this.#hostOf();
    if (host !== null) attempt(() => host.peer.send(withPrefix(type, id, null)));
  }

  #endClients(): void {
    for (const client of this.#clients()) {
      this.#ports.retire(client.peer);
      closeWithReason(client.peer, closeCodes.hostLeft, "host left");
    }
  }

  #leave(member: Member<P>): void {
    this.#ports.retire(member.peer);
    if (member.role === "host") this.#endClients();
    else this.#tellHost(relayFrame.left, member.id);
  }

  // Closes a connection for breaking a rule; it leaves the room now rather than when its close arrives.
  #drop(member: Member<P>, code: number, reason: string): void {
    closeWithReason(member.peer, code, reason);
    this.#leave(member);
  }

  #receiveFromClient(client: Member<P> & { role: "client" }, data: Uint8Array): void {
    if (data.byteLength + prefixBytes > this.#limits.maxFrameBytes) {
      this.#drop(client, closeCodes.frameTooLarge, "frame too large");
      return;
    }
    const host = this.#hostOf();
    if (host === null) return;
    this.#forwarded += 1;
    attempt(() => host.peer.send(withPrefix(relayFrame.forward, client.id, data)));
  }

  #receiveFromHost(host: Member<P>, data: Uint8Array): void {
    const type = data[0];
    if (data.byteLength < prefixBytes || type === void 0 || !hostFrameTypes.has(type)) {
      this.#drop(host, closeCodes.malformedFrame, "malformed frame");
      return;
    }
    const id = data.subarray(1, prefixBytes);
    const client = this.#clients().find((candidate) => constantTimeEqual(candidate.id, id));
    // An unknown id is a client that has just left; the host cannot know yet.
    if (client === void 0) return;
    if (type === hostFrame.forward) {
      this.#forwarded += 1;
      attempt(() => client.peer.send(data.subarray(prefixBytes)));
      return;
    }
    this.#drop(client, closeCodes.normal, "disconnected");
  }
}

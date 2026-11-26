import { constantTimeEqual } from "@outlore/channel/constantTimeEqual";
import { Clock, Effect, Semaphore } from "effect";
import {
  attempt,
  clientIdBytes,
  closeCodes,
  closeWithReason,
  defaultRoomLimits,
  hostFrame,
  prefixBytes,
  type Rejection,
  type RoomLimits,
  type RoomPeer,
  relayFrame,
  withPrefix,
} from "./roomFrames.ts";
import type { Role } from "./route.ts";

export { defaultRoomLimits, type RoomLimits } from "./roomFrames.ts";

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

const hostFrameTypes: ReadonlySet<number> = new Set(Object.values(hostFrame));

const claimMismatch = { code: closeCodes.claimMismatch, reason: "claim mismatch" } as const satisfies Rejection;

const sha256 = (bytes: Uint8Array) =>
  Effect.promise(async () => new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes))));

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
  // What each connection has left of its frame budget. In memory only: a flood keeps the object awake, so the budget
  // lasts exactly while it matters, and a connection that outlives a hibernation starts with a full one.
  readonly #budgets = new WeakMap<P, { at: number; frames: number }>();
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
    return Clock.currentTimeMillis.pipe(Effect.map((now) => this.#receive(peer, data, now)));
  }

  /** Handles the end of a connection, however it ended. */
  close(peer: P): Effect.Effect<void> {
    return Effect.sync(() => {
      const member = this.#ports.memberOf(peer);
      if (member !== null) this.#leave(member);
    });
  }

  // Takes one frame from the connection's budget, refilled by the time since its last frame; false when it is spent.
  #spend(peer: P, now: number): boolean {
    const { frameBurst, maxFramesPerSecond } = this.#limits;
    const budget = this.#budgets.get(peer) ?? { at: now, frames: frameBurst };
    budget.frames = Math.min(frameBurst, budget.frames + ((now - budget.at) * maxFramesPerSecond) / 1000);
    budget.at = now;
    this.#budgets.set(peer, budget);
    if (budget.frames < 1) return false;
    budget.frames -= 1;
    return true;
  }

  #receive(peer: P, data: string | Uint8Array, now: number): void {
    const member = this.#ports.memberOf(peer);
    if (member === null) return;
    if (!this.#spend(peer, now)) {
      this.#drop(member, closeCodes.rateLimited, "rate limited");
      return;
    }
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

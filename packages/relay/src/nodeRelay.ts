import { createServer, type IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { Clock, Effect, Schema } from "effect";
import { type WebSocket, WebSocketServer } from "ws";
import { closeCodes, closeWithReason, defaultRoomLimits, type Member, RoomCore, type RoomLimits } from "./roomCore.ts";
import { parseConnect } from "./route.ts";

/** What `startNodeRelay` accepts. */
export type NodeRelayOptions = Partial<RoomLimits> & {
  /** The address to listen on; defaults to 127.0.0.1. */
  readonly host?: string;
  /** How long a room with nobody in it is kept before a new room may take its place; defaults to 7 days. */
  readonly idleRoomMillis?: number;
  /** The port to listen on; 0, the default, picks a free one. */
  readonly port?: number;
};

/** A running relay. */
export type NodeRelay = {
  /** Stops listening and closes every connection; the scope that started the relay does this too. */
  readonly close: Effect.Effect<void>;
  /** The port the relay listens on. */
  readonly port: number;
  /** How many rooms the relay holds now. */
  rooms(): number;
};

/** The relay could not start listening. */
export class NodeRelayFailure extends Schema.TaggedError<NodeRelayFailure>()("NodeRelayFailure", {
  reason: Schema.String,
}) {}

/** How long a room with nobody in it is kept: its claim is held in memory, so dropping it frees the name. */
export const defaultIdleRoomMillis = 7 * 24 * 60 * 60 * 1000;

type Room = {
  readonly core: RoomCore<WebSocket>;
  readonly members: Map<WebSocket, Member<WebSocket>>;
  /** When a connection last arrived or left. */
  touchedAt: number;
};

// A room lives while somebody is in it, and then for the idle period: its host claim is held in memory, as the
// Durable Object holds it in storage.
const createRoom = (limits: Partial<RoomLimits>, now: number): Room => {
  const members = new Map<WebSocket, Member<WebSocket>>();
  let claim: Uint8Array | null = null;
  const core = new RoomCore<WebSocket>(
    {
      enroll: (member) => members.set(member.peer, member),
      memberOf: (peer) => members.get(peer) ?? null,
      members: () => [...members.values()],
      readClaim: () => Effect.sync(() => claim),
      retire: (peer) => members.delete(peer),
      writeClaim: (hash) =>
        Effect.sync(() => {
          claim = hash;
        }),
    },
    limits,
  );
  return { core, members, touchedAt: now };
};

const refuse = (socket: Duplex): void => {
  socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
};

/**
 * Starts the relay on plain Node with `ws`, speaking the same wire protocol as the Worker, and stops it when the scope
 * ends. It holds nothing about a room but its host claim, and passes frames on without reading them. Only a host
 * makes a room; a client for a room nobody holds is told the host is offline and leaves nothing behind.
 */
export const startNodeRelay = (options: NodeRelayOptions = {}) =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      const context = yield* Effect.context<never>();
      const runSync = Effect.runSyncWith(context);
      const runPromise = Effect.runPromiseWith(context);
      const limits: Partial<RoomLimits> = {
        ...(options.maxClients === void 0 ? {} : { maxClients: options.maxClients }),
        ...(options.maxFrameBytes === void 0 ? {} : { maxFrameBytes: options.maxFrameBytes }),
      };
      const idleRoomMillis = options.idleRoomMillis ?? defaultIdleRoomMillis;
      const rooms = new Map<string, Room>();
      const maxPayload = options.maxFrameBytes ?? defaultRoomLimits.maxFrameBytes;
      const wss = new WebSocketServer({ maxPayload, noServer: true });
      const server = createServer((_request, response) => {
        response.writeHead(404, { "Content-Length": 0 }).end();
      });

      const evictIdleRooms = (now: number) => {
        for (const [name, room] of rooms)
          if (room.members.size === 0 && now - room.touchedAt >= idleRoomMillis) rooms.delete(name);
      };

      const upgrade = (request: IncomingMessage, socket: Duplex, head: Buffer, onOpen: (peer: WebSocket) => void) =>
        wss.handleUpgrade(request, socket, head, (peer) => {
          // ws closes an oversized frame with 1009 itself and reports it here; the close event does the rest.
          peer.on("error", () => null);
          onOpen(peer);
        });

      const accept = (request: IncomingMessage, socket: Duplex, head: Buffer) =>
        Effect.gen(function* () {
          const connect = parseConnect(request.url ?? "");
          if (connect === null) return refuse(socket);
          const now = yield* Clock.currentTimeMillis;
          let room = rooms.get(connect.room);
          if (room === void 0) {
            if (connect.role === "client")
              return upgrade(request, socket, head, (peer) =>
                closeWithReason(peer, closeCodes.hostOffline, "host offline"),
              );
            evictIdleRooms(now);
            room = createRoom(limits, now);
            rooms.set(connect.room, room);
          }
          const held = room;
          held.touchedAt = now;
          const { core } = held;
          const rejection = yield* core.screen(connect.role, connect.claim);
          upgrade(request, socket, head, (peer) => {
            if (rejection !== null) return closeWithReason(peer, rejection.code, rejection.reason);
            peer.on("message", (data, isBinary) => {
              if (isBinary && Buffer.isBuffer(data)) runSync(core.receive(peer, data));
              else if (!isBinary) runSync(core.receive(peer, data.toString()));
            });
            peer.on("close", () =>
              runSync(
                core.close(peer).pipe(
                  Effect.andThen(Clock.currentTimeMillis),
                  Effect.tap((closedAt) =>
                    Effect.sync(() => {
                      held.touchedAt = closedAt;
                    }),
                  ),
                ),
              ),
            );
            runSync(core.open(peer, connect.role));
          });
        });

      server.on("upgrade", (request, socket, head) => {
        socket.on("error", () => null);
        runPromise(accept(request, socket, head)).catch(() => socket.destroy());
      });

      const port = yield* Effect.callback<number, NodeRelayFailure>((resume) => {
        server.once("error", (error) => resume(Effect.fail(new NodeRelayFailure({ reason: error.message }))));
        server.listen(options.port ?? 0, options.host ?? "127.0.0.1", () => {
          const address = server.address();
          resume(
            typeof address === "object" && address !== null
              ? Effect.succeed(address.port)
              : Effect.fail(new NodeRelayFailure({ reason: "The relay did not report its port." })),
          );
        });
      });

      const close = Effect.callback<void>((resume) => {
        for (const peer of wss.clients) peer.terminate();
        wss.close();
        server.close(() => resume(Effect.void));
        server.closeAllConnections();
      });
      return { close, port, rooms: () => rooms.size } satisfies NodeRelay;
    }),
    (relay) => relay.close,
  );

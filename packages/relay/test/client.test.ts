import { it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { WebSocketServer } from "ws";
import { connectClient as clientEffect, connectHost as hostEffect, keepAlive } from "../src/client.ts";
import { closingFrame } from "../src/roomCore.ts";
import { claimProtocolOf, relayProtocol } from "../src/route.ts";
import { room } from "./fixtures/wsClient.ts";

const resultOf = <Value>(effect: Effect.Effect<Value, { readonly kind: "unreachable" }>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.match({
        onFailure: (error) => ({ kind: error.kind, ok: false as const }),
        onSuccess: (value) => ({ ok: true as const, value }),
      }),
    ),
  );
const connectClient = (...args: Parameters<typeof clientEffect>) => resultOf(clientEffect(...args));
const connectHost = (...args: Parameters<typeof hostEffect>) => resultOf(hostEffect(...args));

// A relay that says why it closes a connection, then keeps the connection open: a client that waits for the close
// would learn nothing (Node's own WebSocket waits about ten seconds for the connection to end), so it must act on the
// frame. This server never closes anything.
let server: WebSocketServer | null = null;
const sockets: import("ws").WebSocket[] = [];

const serve = async (
  onConnection: (socket: import("ws").WebSocket, request: import("node:http").IncomingMessage) => void,
  options: import("ws").ServerOptions = {},
) => {
  const created = new WebSocketServer({ host: "127.0.0.1", port: 0, ...options });
  server = created;
  created.on("connection", (socket, request) => {
    sockets.push(socket);
    socket.on("error", () => null);
    onConnection(socket, request);
  });
  await new Promise<void>((resolve) => created.once("listening", resolve));
  return `http://127.0.0.1:${(created.address() as { port: number }).port}`;
};

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  const closing = server;
  server = null;
  if (closing !== null) await new Promise<void>((resolve) => closing.close(() => resolve()));
});

// The sockets the code under test opened, so a test can listen to one after the code's own listeners: its listener then
// runs once the code has handled that event, with no waiting by the clock.
const opened: WebSocket[] = [];
beforeEach(() => {
  const Standard = WebSocket;
  vi.stubGlobal(
    "WebSocket",
    class extends Standard {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        opened.push(this);
      }
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  opened.length = 0;
});
const closedLocally = (socket: WebSocket | undefined) =>
  new Promise<void>((resolve) => {
    if (socket === undefined) throw new Error("no socket was opened");
    socket.addEventListener("close", () => resolve(), { once: true });
  });

describe("a client of the relay", () => {
  it("learns why the relay closed it from the frame, while the connection is still open", async () => {
    const relayOrigin = await serve((socket) => socket.send(closingFrame(1013, "host offline")));
    const connected = await connectClient({ relayOrigin, room });
    if (!connected.ok) throw new Error("not connected");
    const ended = new Promise<void>((resolve) => connected.value.carrier.onClose(resolve));
    await ended;
    expect(connected.value.closeCode()).toBe(1013);
  });

  it("reads the frame even when it arrives before anyone is listening", async () => {
    const relayOrigin = await serve((socket) => socket.send(closingFrame(1001, "host left")));
    const connected = await connectClient({ relayOrigin, room });
    if (!connected.ok) throw new Error("not connected");
    await vi.waitFor(() => expect(connected.value.closeCode()).toBe(1001));
    let told = 0;
    connected.value.carrier.onClose(() => {
      told += 1;
    });
    expect(told).toBe(1);
  });

  it("tells its listeners once when the frame and the close both arrive", async () => {
    const relayOrigin = await serve((socket) => {
      socket.send(closingFrame(1001, "host left"));
      socket.close(1001, "host left");
    });
    const connected = await connectClient({ relayOrigin, room });
    if (!connected.ok) throw new Error("not connected");
    let told = 0;
    connected.value.carrier.onClose(() => {
      told += 1;
    });
    await closedLocally(opened[0]);
    expect(told).toBe(1);
    expect(connected.value.closeCode()).toBe(1001);
  });

  it("does not take a pong, a stray text, or a frame that is not a closing for the end", async () => {
    const relayOrigin = await serve((socket) => {
      socket.send("pong");
      socket.send("hello");
      socket.send('{"closing":7}');
      // Frames arrive in order: once this one is read, the three before it were handled.
      socket.send(new Uint8Array([1]));
    });
    const connected = await connectClient({ relayOrigin, room });
    if (!connected.ok) throw new Error("not connected");
    let told = 0;
    connected.value.carrier.onClose(() => {
      told += 1;
    });
    await new Promise<void>((resolve) => connected.value.carrier.onMessage(() => resolve()));
    expect(told).toBe(0);
    expect(connected.value.closeCode()).toBeNull();
  });
});

describe("a host of the relay", () => {
  it("learns why the relay closed it from the frame, while the connection is still open", async () => {
    const relayOrigin = await serve((socket) => socket.send(closingFrame(1008, "claim mismatch")));
    const connected = await connectHost({ claim: new Uint8Array(32).fill(7), relayOrigin, room });
    if (!connected.ok) throw new Error("not connected");
    const ended = new Promise<{ code: number; reason: string }>((resolve) =>
      connected.value.onClose((code, reason) => resolve({ code, reason })),
    );
    expect(await ended).toEqual({ code: 1008, reason: "claim mismatch" });
  });

  it("tells its listener once when the frame and the close both arrive", async () => {
    const relayOrigin = await serve((socket) => {
      socket.send(closingFrame(1012, "replaced"));
      socket.close(1012, "replaced");
    });
    const connected = await connectHost({ claim: new Uint8Array(32).fill(7), relayOrigin, room });
    if (!connected.ok) throw new Error("not connected");
    const seen: number[] = [];
    connected.value.onClose((code) => seen.push(code));
    await closedLocally(opened[0]);
    expect(seen).toEqual([1012]);
  });
});

describe("keeping a connection alive", () => {
  const claim = new Uint8Array(32).fill(7);
  const pingsOf = (pings: string[], count: number) =>
    Effect.promise(() => vi.waitFor(() => expect(pings).toHaveLength(count)));

  it.effect("pings the relay every 25 seconds while the connection is open, as a host", () =>
    Effect.gen(function* () {
      const pings: string[] = [];
      const relayOrigin = yield* Effect.promise(() =>
        serve((socket) => socket.on("message", (data) => pings.push(data.toString()))),
      );
      yield* hostEffect({ claim, relayOrigin, room });
      yield* TestClock.adjust(24_999);
      yield* Effect.promise(() => new Promise((resolve) => setImmediate(resolve)));
      expect(pings).toEqual([]);
      yield* TestClock.adjust(1);
      yield* pingsOf(pings, 1);
      yield* TestClock.adjust(25_000);
      yield* pingsOf(pings, 2);
      expect(pings).toEqual(["ping", "ping"]);
    }),
  );

  it.effect("pings as a client too, and stops once the connection closed", () =>
    Effect.gen(function* () {
      const pings: string[] = [];
      const relayOrigin = yield* Effect.promise(() =>
        serve((socket) => socket.on("message", (data) => pings.push(data.toString()))),
      );
      const connection = yield* clientEffect({ relayOrigin, room });
      yield* TestClock.adjust(25_000);
      yield* pingsOf(pings, 1);
      const closed = closedLocally(opened[0]);
      connection.carrier.close();
      yield* Effect.promise(() => closed);
      yield* TestClock.adjust(100_000);
      yield* Effect.promise(() => new Promise((resolve) => setImmediate(resolve)));
      expect(pings).toEqual(["ping"]);
    }),
  );

  it.effect("ends at once for a socket that is already closed, instead of waiting for a close it missed", () =>
    Effect.gen(function* () {
      const pings: string[] = [];
      const closedSocket = {
        addEventListener: () => {},
        readyState: WebSocket.CLOSED,
        send: (text: string) => void pings.push(text),
      };
      const keeping = yield* Effect.forkChild(keepAlive(closedSocket), { startImmediately: true });
      expect(keeping.pollUnsafe()).toBeDefined();
      yield* Fiber.join(keeping);
      yield* TestClock.adjust(100_000);
      expect(pings).toEqual([]);
    }),
  );
});

describe("a host's claim on the wire", () => {
  const claim = Uint8Array.from({ length: 24 }, (_, index) => index + 1);

  it("travels in the subprotocols and not in the address", async () => {
    let seen: { protocols: string | undefined; url: string | undefined } | null = null;
    const relayOrigin = await serve((_socket, request) => {
      seen = { protocols: request.headers["sec-websocket-protocol"], url: request.url };
    });
    const result = await connectHost({ claim, relayOrigin, room });
    expect(result.ok).toBe(true);
    await vi.waitFor(() => expect(seen).not.toBeNull());
    expect(seen).toEqual({
      protocols: `${relayProtocol}, ${claimProtocolOf(claim)}`,
      url: `/r/${room}?role=host`,
    });
    if (result.ok) expect(result.value.usesLegacyClaim).toBe(false);
  });

  // A relay of an earlier release: it knows only the address form, so it turns away a connection that offers subprotocols.
  const earlier = {
    verifyClient: (info: { req: import("node:http").IncomingMessage }) => !info.req.headers["sec-websocket-protocol"],
  };

  it("does not fall back to the address by itself: an earlier relay is unreachable", async () => {
    const relayOrigin = await serve(() => {}, earlier);
    expect(await connectHost({ claim, relayOrigin, room })).toEqual({ kind: "unreachable", ok: false });
  });

  it("falls back to the address form for a relay of an earlier release, when told to, and says so", async () => {
    const urls: (string | undefined)[] = [];
    const relayOrigin = await serve((_socket, request) => urls.push(request.url), earlier);
    const result = await connectHost({ claim, legacyFallback: true, relayOrigin, room });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.usesLegacyClaim).toBe(true);
    await vi.waitFor(() => expect(urls).toHaveLength(1));
    expect(urls[0]).toMatch(/^\/r\/[^?]+\?claim=[A-Za-z0-9_-]+&role=host$/);
  });

  it("does not use the address when the subprotocol form worked", async () => {
    const urls: (string | undefined)[] = [];
    const relayOrigin = await serve((_socket, request) => urls.push(request.url));
    await connectHost({ claim, legacyFallback: true, relayOrigin, room });
    await vi.waitFor(() => expect(urls).toHaveLength(1));
    expect(urls[0]).not.toContain("claim=");
  });
});

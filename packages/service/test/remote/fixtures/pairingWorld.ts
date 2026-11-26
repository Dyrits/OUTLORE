import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Request, type ServerFrame, ServerFrameJson } from "@outlore/contracts";
import { startNodeRelay } from "@outlore/relay";
import { Effect, Layer, Schema, Stream } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { fakeHarnessLayer, Service, serveLoopback, serviceLayer } from "../../../src/index.ts";
import { openHostChannel } from "../../../src/remote/index.ts";
import { HostPresence } from "../../../src/remote/presence.ts";

// Two whole services, each over its own database, joined by a real local relay: the host accepts paired devices and
// the controller pairs with it and steers it through its own loopback socket (device-pairing).

const TOKEN = "owner-token-for-tests";
const decodeFrame = Schema.decodeUnknownSync(ServerFrameJson);

/** Temporary folders removed after each pairing test. */
export const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const machine = (computerName: string, relayOrigin: string, release = "development") => {
  const directory = mkdtempSync(join(tmpdir(), "outlore-remote-"));
  directories.push(directory);
  return serviceLayer({
    computerName,
    filename: join(directory, "outlore.sqlite"),
    harness: fakeHarnessLayer("10 millis"),
    homeFolder: directory,
    relayOrigin,
    release,
    scratchRoot: join(directory, "missions"),
  });
};

export const until = <Value>(check: () => Value | undefined | Promise<Value | undefined>) =>
  Effect.gen(function* () {
    for (let index = 0; index < 300; index++) {
      const value = yield* Effect.promise(async () => check());
      if (value !== undefined) return value;
      yield* Effect.sleep("20 millis");
    }
    return yield* Effect.fail(new Error("timed out waiting"));
  });

/** A socket to a loopback server, remembering the frames it received and how it closed. */
interface Link {
  readonly closed: { code: number; reason: string } | null;
  readonly frames: ServerFrame[];
  readonly socket: WebSocket;
}

const connect = (url: string) =>
  Effect.callback<Link, Error>((resume) => {
    const state = { closed: null as { code: number; reason: string } | null, frames: [] as ServerFrame[] };
    const socket = new WebSocket(url);
    socket.addEventListener("message", (event) => state.frames.push(decodeFrame(event.data)));
    socket.addEventListener("close", (event) => {
      state.closed = { code: event.code, reason: event.reason };
    });
    socket.addEventListener("open", () =>
      resume(
        Effect.succeed({
          ...state,
          get closed() {
            return state.closed;
          },
          get frames() {
            return state.frames;
          },
          socket,
        }),
      ),
    );
    socket.addEventListener("error", () => resume(Effect.fail(new Error("connection refused"))));
  });

/** Two services and a relay; the controller's loopback server is up. */
/** `controllerRelay` is the relay address the controller itself is set up with, when it is not the one in use. */
export const makeWorld = (options: { controllerRelay?: string; controllerRelease?: string } = {}) =>
  Effect.gen(function* () {
    const relay = yield* startNodeRelay();
    const relayOrigin = `http://127.0.0.1:${relay.port}`;
    const hostContext = yield* Layer.build(machine("Host Mac", relayOrigin));
    const controllerContext = yield* Layer.build(
      machine("Laptop", options.controllerRelay ?? relayOrigin, options.controllerRelease),
    );
    const { port } = yield* serveLoopback({ port: 0, token: TOKEN }).pipe(Effect.provideContext(controllerContext));

    const on =
      (context: typeof hostContext) =>
      <R extends Request>(request: R) =>
        Effect.gen(function* () {
          const service = yield* Service;
          return yield* service.handle(request);
        }).pipe(Effect.provideContext(context));
    const host = on(hostContext);
    const controller = on(controllerContext);
    const hostSql = <Value, Error>(work: (sql: SqlClient.SqlClient) => Effect.Effect<Value, Error>) =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        return yield* work(sql);
      }).pipe(Effect.provideContext(hostContext));

    const accessOf = () => host({ _tag: "ReadRemoteAccess" });

    /** Turns pairing on at the host and waits until its relay connection is up. */
    const allowPairing = Effect.gen(function* () {
      yield* host({ _tag: "SetRemoteAccess", isEnabled: true });
      const presence = yield* HostPresence.pipe(Effect.provideContext(hostContext));
      yield* Stream.runHead(Stream.filter(presence.statusChanges, (status) => status === "Connected"));
    });

    const newCode = () =>
      host({ _tag: "CreatePairingCode" }).pipe(Effect.map((made) => (made as { code: string }).code));
    const pair = (code: string, deviceName = "Laptop") =>
      controller({ _tag: "AddHost", code, deviceName }) as Effect.Effect<{ id: string; name: string }, unknown>;
    const bridge = (hostId: string) => connect(`ws://127.0.0.1:${port}/host/${hostId}?token=${TOKEN}`);
    const ask = (link: Link, id: string, request: object) =>
      Effect.gen(function* () {
        link.socket.send(JSON.stringify({ id, request }));
        return yield* until(() => link.frames.find((frame) => "id" in frame && frame.id === id));
      });
    const controllerSql = <Value, Error>(work: (sql: SqlClient.SqlClient) => Effect.Effect<Value, Error>) =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        return yield* work(sql);
      }).pipe(Effect.provideContext(controllerContext));
    const open = (id: string) => openHostChannel(id).pipe(Effect.provideContext(controllerContext));
    return {
      accessOf,
      allowPairing,
      ask,
      bridge,
      controller,
      controllerSql,
      host,
      hostContext,
      hostSql,
      newCode,
      open,
      pair,
      presence: HostPresence.pipe(Effect.provideContext(hostContext)),
    };
  });

export const world = makeWorld();

export const claimedMission = (text: string) => ({
  _tag: "StartMission",
  effort: "default",
  model: "default",
  requestId: crypto.randomUUID(),
  text,
  workspacePath: null,
});

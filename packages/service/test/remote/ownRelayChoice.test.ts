import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { decodePairingCode } from "@outlore/channel";
import { type Request, type ServerFrame, ServerFrameJson } from "@outlore/contracts";
import { startNodeRelay } from "@outlore/relay";
import { Effect, Layer, Schema } from "effect";
import { afterEach } from "vitest";
import { fakeHarnessLayer, Service, serveLoopback, serviceLayer } from "../../src/index.ts";
import type { DeployResult } from "../../src/remote/index.ts";

// The owner may deploy the relay to their own Cloudflare account with one token and use it in place of the shared one;
// two local relays stand for the two (device-pairing, own relay).

const TOKEN = "owner-token-for-tests";
const CLOUDFLARE_TOKEN = "cf-secret-token-0123456789";
const decodeFrame = Schema.decodeUnknownSync(ServerFrameJson);

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const until = <Value>(check: () => Value | undefined | Promise<Value | undefined>) =>
  Effect.gen(function* () {
    for (let index = 0; index < 400; index++) {
      const value = yield* Effect.promise(async () => check());
      if (value !== undefined) return value;
      yield* Effect.sleep("20 millis");
    }
    return yield* Effect.fail(new Error("timed out waiting"));
  });

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

/** What the stand-in for the Cloudflare deployment was asked, and what it answers. */
interface Deployment {
  answer: DeployResult;
  readonly tokens: string[];
}

const deployed = (origin: string): DeployResult => ({
  accountName: "Owner Account",
  createdSubdomain: false,
  ok: true,
  origin,
  wasUpdated: false,
  workerName: "outlore-relay",
});

const makeWorld = Effect.gen(function* () {
  const shared = yield* startNodeRelay();
  const own = yield* startNodeRelay();
  const sharedOrigin = `http://127.0.0.1:${shared.port}`;
  const ownOrigin = `http://127.0.0.1:${own.port}`;
  const deployment: Deployment = { answer: deployed(ownOrigin), tokens: [] };
  const hostDirectory = mkdtempSync(join(tmpdir(), "outlore-own-relay-host-"));
  const controllerDirectory = mkdtempSync(join(tmpdir(), "outlore-own-relay-controller-"));
  directories.push(hostDirectory, controllerDirectory);
  const machine = (computerName: string, directory: string) =>
    serviceLayer({
      computerName,
      deployOwnRelay: (token) => {
        deployment.tokens.push(token);
        return Promise.resolve(deployment.answer);
      },
      filename: join(directory, "outlore.sqlite"),
      harness: fakeHarnessLayer("10 millis"),
      homeFolder: directory,
      relayOrigin: sharedOrigin,
      scratchRoot: join(directory, "missions"),
    });
  const hostContext = yield* Layer.build(machine("Host Mac", hostDirectory));
  const controllerContext = yield* Layer.build(machine("Laptop", controllerDirectory));
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
  const accessOf = () => host({ _tag: "ReadRemoteAccess" });
  const waitFor = (status: string) =>
    until(() => Effect.runPromise(accessOf()).then((view) => (view.status === status ? view : undefined)));
  const allowPairing = Effect.gen(function* () {
    yield* host({ _tag: "SetRemoteAccess", isEnabled: true });
    yield* waitFor("Connected");
  });
  const newCode = () => host({ _tag: "CreatePairingCode" }).pipe(Effect.map((made) => (made as { code: string }).code));
  const pair = (code: string) =>
    controller({ _tag: "AddHost", code, deviceName: "Laptop" }) as Effect.Effect<{ id: string; name: string }, unknown>;
  const bridge = (hostId: string) => connect(`ws://127.0.0.1:${port}/host/${hostId}?token=${TOKEN}`);
  const ask = (link: Link, id: string, request: object) =>
    Effect.gen(function* () {
      link.socket.send(JSON.stringify({ id, request }));
      return yield* until(() => link.frames.find((frame) => "id" in frame && frame.id === id));
    });
  const useOwnRelay = (token: string) => host({ _tag: "UseOwnRelay", token });
  const useSharedRelay = () => host({ _tag: "UseSharedRelay" });
  /** Everything the host's data folder holds, as text, to look for what must not be kept. */
  const hostFilesAsText = () =>
    readdirSync(hostDirectory)
      .filter((name) => name.startsWith("outlore.sqlite"))
      .map((name) => readFileSync(join(hostDirectory, name)).toString("latin1"))
      .join("\n");
  return {
    accessOf,
    allowPairing,
    ask,
    bridge,
    deployment,
    host,
    hostFilesAsText,
    newCode,
    ownOrigin,
    pair,
    sharedOrigin,
    useOwnRelay,
    useSharedRelay,
    waitFor,
  };
});

describe("choosing a relay of one's own", () => {
  it.live("uses the shared relay until the owner chooses another", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld;
        expect(yield* world.accessOf()).toMatchObject({ isOwnRelay: false, relayOrigin: world.sharedOrigin });
      }),
    ),
  );

  it.live("deploys with the token given, moves to the new relay, and names it in the next pairing code", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld;
        yield* world.allowPairing;
        const view = yield* world.useOwnRelay(`  ${CLOUDFLARE_TOKEN}  `);
        expect(world.deployment.tokens).toEqual([CLOUDFLARE_TOKEN]);
        expect(view).toMatchObject({ isOwnRelay: true, relayOrigin: world.ownOrigin });
        // The host reconnects through the new relay by itself.
        expect((yield* world.waitFor("Connected")).relayOrigin).toBe(world.ownOrigin);
        const code = yield* world.newCode();
        expect(decodePairingCode(code)).toMatchObject({ ok: true, value: { relayOrigin: world.ownOrigin } });
        expect(yield* world.pair(code)).toMatchObject({ name: "Host Mac" });
      }),
    ),
  );

  it.live("can be chosen before pairing was ever switched on, and is used when it is", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld;
        const view = yield* world.useOwnRelay(CLOUDFLARE_TOKEN);
        expect(view).toMatchObject({ isEnabled: false, isOwnRelay: true, status: "Off" });
        yield* world.allowPairing;
        expect((yield* world.accessOf()).relayOrigin).toBe(world.ownOrigin);
        expect(decodePairingCode(yield* world.newCode())).toMatchObject({ value: { relayOrigin: world.ownOrigin } });
      }),
    ),
  );

  it.live("ends the paired devices' connections when the relay changes, and serves them again on their own relay", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld;
        yield* world.allowPairing;
        const host = yield* world.pair(yield* world.newCode());
        const link = yield* world.bridge(host.id);
        expect(yield* world.ask(link, "1", { _tag: "ReadHostName" })).toMatchObject({
          _tag: "Success",
          value: "Host Mac",
        });

        yield* world.useOwnRelay(CLOUDFLARE_TOKEN);
        yield* until(() => link.closed ?? undefined);
        yield* world.waitFor("Connected");
        // The pairing is kept, so the owner can still see and disconnect the device.
        expect((yield* world.accessOf()).devices).toMatchObject([{ name: "Laptop" }]);
        // The device paired through the shared relay, so it cannot reach a host that left it.
        const lost = yield* world.bridge(host.id);
        expect((yield* until(() => lost.closed ?? undefined)).code).toBe(4000);

        const back = yield* world.useSharedRelay();
        expect(back).toMatchObject({ isOwnRelay: false, relayOrigin: world.sharedOrigin });
        yield* world.waitFor("Connected");
        const again = yield* world.bridge(host.id);
        expect(yield* world.ask(again, "2", { _tag: "ReadHostName" })).toMatchObject({
          _tag: "Success",
          value: "Host Mac",
        });
        again.socket.close();
      }),
    ),
  );

  it.live(
    "updates the relay in place when its address does not change, without disturbing the host or its devices",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const world = yield* makeWorld;
          yield* world.allowPairing;
          yield* world.useOwnRelay(CLOUDFLARE_TOKEN);
          yield* world.waitFor("Connected");
          const host = yield* world.pair(yield* world.newCode());
          const link = yield* world.bridge(host.id);
          expect(yield* world.ask(link, "1", { _tag: "ReadHostName" })).toMatchObject({ _tag: "Success" });

          // Same address: the Worker was updated where it stands.
          const again = yield* world.useOwnRelay(CLOUDFLARE_TOKEN);
          expect(world.deployment.tokens).toHaveLength(2);
          expect(again).toMatchObject({ isOwnRelay: true, relayOrigin: world.ownOrigin, status: "Connected" });
          expect(link.closed).toBeNull();
          expect(yield* world.ask(link, "2", { _tag: "ReadHostName" })).toMatchObject({
            _tag: "Success",
            value: "Host Mac",
          });
          link.socket.close();
        }),
      ),
  );

  it.live("keeps the relay it had when the deployment fails, and says why", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld;
        yield* world.allowPairing;
        world.deployment.answer = {
          failure: "token-rejected",
          message: "Cloudflare did not accept that token.",
          ok: false,
        };
        const failed = yield* Effect.flip(world.useOwnRelay(CLOUDFLARE_TOKEN));
        expect(failed).toMatchObject({ message: "Cloudflare did not accept that token." });
        expect(yield* world.accessOf()).toMatchObject({
          isOwnRelay: false,
          relayOrigin: world.sharedOrigin,
          status: "Connected",
        });
      }),
    ),
  );

  it.live("asks for a token before it deploys anything", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld;
        const failed = yield* Effect.flip(world.useOwnRelay("   "));
        expect(failed).toMatchObject({ kind: "InvalidInput" });
        expect(world.deployment.tokens).toEqual([]);
      }),
    ),
  );

  it.live("keeps the token nowhere in the database, whether the deployment worked or not", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld;
        yield* world.allowPairing;
        world.deployment.answer = { failure: "no-permission", message: "No.", ok: false };
        yield* Effect.flip(world.useOwnRelay(CLOUDFLARE_TOKEN));
        world.deployment.answer = deployed(world.ownOrigin);
        yield* world.useOwnRelay(CLOUDFLARE_TOKEN);
        yield* world.waitFor("Connected");
        const files = world.hostFilesAsText();
        expect(files.length).toBeGreaterThan(1_000);
        expect(files).not.toContain(CLOUDFLARE_TOKEN);
        // The relay address it chose is kept: it is not a secret, and the host needs it at the next start.
        expect(files).toContain(world.ownOrigin);
      }),
    ),
  );

  it.live("returns to the shared relay on request, and does nothing when it never left", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld;
        expect(yield* world.useSharedRelay()).toMatchObject({ isOwnRelay: false, relayOrigin: world.sharedOrigin });
        yield* world.useOwnRelay(CLOUDFLARE_TOKEN);
        expect(yield* world.useSharedRelay()).toMatchObject({ isOwnRelay: false, relayOrigin: world.sharedOrigin });
        expect(decodePairingCode(yield* world.newCode())).toMatchObject({ value: { relayOrigin: world.sharedOrigin } });
      }),
    ),
  );
});

import { existsSync } from "node:fs";
import { homedir } from "node:os";
// Entry point when Electron starts the service as a utilityProcess.
import { delimiter, join } from "node:path";
import { defaultStunServers } from "@outlore/channel";
import { Cause, Config, Effect, Exit, Layer, Predicate, Record } from "effect";
import { Harness, modelsDevSourceLayer, noPriceSourceLayer, sandboxProblem, vaultFolderOf } from "./core/index.ts";
import {
  commandEnvVarOf,
  defaultCommandOf,
  fakeHarnessLayer,
  fakeHarnessToolsLayer,
  harnessFacts,
  liveHarnessToolsLayer,
  makeHarnessRouter,
} from "./harness/index.ts";
import { defaultRelayOrigin, weriftDirectSettings } from "./remote/index.ts";
import { serveLoopback } from "./server.ts";
import { serviceLayer } from "./service.ts";
import { parentPortUpdaterLayer, type UpdaterPort } from "./update/index.ts";

interface ParentPort extends UpdaterPort {}

/** Electron's utility process gives `process` a `parentPort`; any other host has none. */
const parentPortOf = (host: unknown): ParentPort | null => {
  if (!Predicate.hasProperty(host, "parentPort")) return null;
  const port = host.parentPort;
  if (!Predicate.hasProperty(port, "postMessage")) return null;
  const postMessage = port.postMessage;
  if (!Predicate.isFunction(postMessage)) return null;
  const on = Predicate.hasProperty(port, "on") ? port.on : null;
  return {
    // The main process's messages arrive as events whose `data` is the message.
    onMessage: (listener) => {
      if (!Predicate.isFunction(on)) return;
      on.call(port, "message", (event: unknown) => listener(Predicate.hasProperty(event, "data") ? event.data : event));
    },
    postMessage: (message) => postMessage.call(port, message),
  };
};

const parentPort = parentPortOf(process);

/** Whether an executable exists on PATH. */
const hasExecutableOnPath = (executable: string) => {
  const suffix = process.platform === "win32" ? ".exe" : "";
  const folders = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  return folders.some((folder) => existsSync(join(folder, `${executable}${suffix}`)));
};

// A missing variable fails the program through Config instead of throwing at import.
const liveLayer = Layer.unwrap(
  Effect.gen(function* () {
    const dataDirectory = yield* Config.NonEmptyString("OUTLORE_DATA_DIR");
    // OUTLORE_HARNESS=fake selects the echo harness for checks.
    const harnessName = yield* Config.String("OUTLORE_HARNESS").pipe(Config.withDefault("claude"));
    const commands = yield* Effect.all(
      Record.map(harnessFacts, (_facts, name) =>
        Effect.gen(function* () {
          const fallback = yield* Effect.sync(() => defaultCommandOf(name, hasExecutableOnPath));
          return yield* Config.String(commandEnvVarOf(name)).pipe(Config.withDefault(fallback));
        }),
      ),
    );
    // OUTLORE_RELAY_ORIGIN points pairing at another relay, such as one run locally for checks (device-pairing).
    const relayOrigin = yield* Config.String("OUTLORE_RELAY_ORIGIN").pipe(Config.withDefault(defaultRelayOrigin));
    // Direct channels between a host and its devices, through werift; OUTLORE_DIRECT=false keeps every link on the
    // relay, and OUTLORE_STUN_SERVERS (comma separated stun: addresses) replaces the default STUN server.
    const isDirect = yield* Config.Boolean("OUTLORE_DIRECT").pipe(Config.withDefault(true));
    const stunServers = yield* Config.String("OUTLORE_STUN_SERVERS").pipe(Config.withDefault(""));
    // OUTLORE_RELEASE is the release the desktop app runs; a host tells it to the browsers that connect.
    const release = yield* Config.String("OUTLORE_RELEASE").pipe(Config.withDefault("development"));
    // The Worker's name on the owner's own Cloudflare account, for a check that must not touch a Worker already there.
    const ownRelayWorkerName = yield* Config.String("OUTLORE_OWN_RELAY_NAME").pipe(Config.withDefault(""));
    const problem = yield* sandboxProblem;
    const idleTimeout = "10 minutes";
    // Every thread's harness has its own adapter; turns go to the one their thread runs on (provider-accounts).
    const harness =
      harnessName === "fake"
        ? fakeHarnessLayer("1500 millis")
        : Layer.effect(
            Harness,
            makeHarnessRouter(commands, {
              dataDirectory,
              idleTimeout,
              sandboxProblem: problem,
              vaultFolder: vaultFolderOf(dataDirectory),
            }),
          );
    return Layer.fresh(
      serviceLayer({
        accountsRoot: join(dataDirectory, "accounts"),
        filename: join(dataDirectory, "outlore.sqlite"),
        harness,
        // Only the desktop app's own service can update its host: it reaches the updater through its parent.
        ...(parentPort === null ? {} : { hostUpdater: parentPortUpdaterLayer(parentPort) }),
        ...(isDirect
          ? {
              direct: weriftDirectSettings(
                stunServers.trim() === ""
                  ? defaultStunServers
                  : stunServers
                      .split(",")
                      .map((server) => server.trim())
                      .filter((server) => server !== ""),
              ),
            }
          : {}),
        harnessTools: harnessName === "fake" ? fakeHarnessToolsLayer() : liveHarnessToolsLayer(commands),
        homeFolder: homedir(),
        priceSource: harnessName === "fake" ? noPriceSourceLayer : modelsDevSourceLayer(),
        ...(ownRelayWorkerName === "" ? {} : { ownRelayWorkerName }),
        relayOrigin,
        release,
        scratchRoot: join(dataDirectory, "missions"),
      }),
    );
  }),
);

const program = Effect.gen(function* () {
  const token = yield* Config.NonEmptyString("OUTLORE_TOKEN");
  const { port } = yield* serveLoopback({ port: 0, token });
  parentPort?.postMessage({ port, type: "ready" });
  return yield* Effect.never;
}).pipe(Effect.scoped, Effect.provide(liveLayer));

Effect.runFork(program).addObserver((exit) => {
  // The cause in full, so a startup failure says why in the desktop app's log.
  console.error("Outlore service stopped", Exit.isFailure(exit) ? Cause.pretty(exit.cause) : exit);
  process.exit(1);
});

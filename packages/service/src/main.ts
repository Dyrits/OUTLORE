import { homedir } from "node:os";
// Entry point when Electron starts the service as a utilityProcess.
import { join } from "node:path";
import { Cause, Config, Effect, Exit, Layer, Predicate } from "effect";
import { Harness, modelsDevSourceLayer, noPriceSourceLayer, sandboxProblem } from "./core/index.ts";
import { fakeHarnessLayer, fakeHarnessToolsLayer, liveHarnessToolsLayer, makeHarnessRouter } from "./harness/index.ts";
import { defaultRelayOrigin } from "./remote/index.ts";
import { serveLoopback } from "./server.ts";
import { serviceLayer } from "./service.ts";
import { parentPortUpdaterLayer, type UpdaterPort } from "./update/parentPortUpdater.ts";

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

// A missing variable fails the program through Config instead of throwing at import.
const liveLayer = Layer.unwrap(
  Effect.gen(function* () {
    const dataDirectory = yield* Config.NonEmptyString("OUTLORE_DATA_DIR");
    // OUTLORE_HARNESS=fake selects the echo harness for checks.
    const harnessName = yield* Config.String("OUTLORE_HARNESS").pipe(Config.withDefault("claude"));
    const commands = {
      claude: yield* Config.String("OUTLORE_CLAUDE_PATH").pipe(Config.withDefault("claude")),
      codex: yield* Config.String("OUTLORE_CODEX_PATH").pipe(Config.withDefault("codex")),
      opencode: yield* Config.String("OUTLORE_OPENCODE_PATH").pipe(Config.withDefault("opencode")),
      vibe: yield* Config.String("OUTLORE_VIBE_PATH").pipe(Config.withDefault("vibe-acp")),
    };
    // OUTLORE_RELAY_ORIGIN points pairing at another relay, such as one run locally for checks (device-pairing).
    const relayOrigin = yield* Config.String("OUTLORE_RELAY_ORIGIN").pipe(Config.withDefault(defaultRelayOrigin));
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
        : Layer.effect(Harness, makeHarnessRouter(commands, { dataDirectory, idleTimeout, sandboxProblem: problem }));
    return Layer.fresh(
      serviceLayer({
        accountsRoot: join(dataDirectory, "accounts"),
        filename: join(dataDirectory, "outlore.sqlite"),
        harness,
        // Only the desktop app's own service can update its host: it reaches the updater through its parent.
        ...(parentPort === null ? {} : { hostUpdater: parentPortUpdaterLayer(parentPort) }),
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

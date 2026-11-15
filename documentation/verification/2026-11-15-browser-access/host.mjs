// bun build host.mjs --target=node --format=esm --outfile /tmp/outlore-drive/host.js (a node_modules link to
// packages/service/node_modules sits beside it), then: node /tmp/outlore-drive/host.js <data folder> <relay origin> <loopback port> <release>
// A host as the desktop app runs it, without the window: the whole service over its own data folder, with the fake
// harness, pairing through the given relay, and its owner's loopback socket on a fixed port (token "drive-token").
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fakeHarnessLayer, serveLoopback, serviceLayer } from "../../../packages/service/src/index.ts";
import { Effect, Layer } from "effect";

const [dataDirectory, relayOrigin, port, release] = process.argv.slice(2);
mkdirSync(dataDirectory, { recursive: true });
const layer = serviceLayer({
  computerName: "Drive Host",
  filename: join(dataDirectory, "outlore.sqlite"),
  harness: fakeHarnessLayer("300 millis"),
  homeFolder: dataDirectory,
  release,
  relayOrigin,
  scratchRoot: join(dataDirectory, "missions"),
});
const program = Effect.gen(function* () {
  yield* serveLoopback({ port: Number(port), token: "drive-token" });
  console.log(JSON.stringify({ ready: true, port: Number(port) }));
  return yield* Effect.never;
}).pipe(Effect.scoped, Effect.provide(Layer.fresh(layer)));
Effect.runFork(program).addObserver((exit) => {
  console.error("host stopped", exit);
  process.exit(1);
});

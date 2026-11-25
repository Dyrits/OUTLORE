import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { fakeHarnessLayer, serveLoopback, serviceLayer } from "../src/index.ts";

// A paired host's link that fails with a defect, not a typed failure, must still end the app's socket.
const brokenHostChannel = () => Effect.die("The host link broke unexpectedly.");

const TOKEN = "owner-token-for-tests";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const fresh = () => {
  const directory = mkdtempSync(join(tmpdir(), "outlore-test-"));
  directories.push(directory);
  return serviceLayer({
    filename: join(directory, "outlore.sqlite"),
    harness: fakeHarnessLayer("10 millis"),
    homeFolder: directory,
    scratchRoot: join(directory, "missions"),
  });
};

/** The code and reason the socket closes with, or an error when it does not close in time. */
const closeOf = (url: string) =>
  Effect.callback<{ code: number; reason: string }, Error>((resume) => {
    const socket = new WebSocket(url);
    socket.addEventListener("close", (event) => resume(Effect.succeed({ code: event.code, reason: event.reason })));
    socket.addEventListener("error", () => resume(Effect.fail(new Error("connection refused"))));
  }).pipe(Effect.timeout("3 seconds"));

describe("bridging the app to a paired host", () => {
  it.live("closes the socket with 4000 when opening the host link fails with a defect", () =>
    Effect.gen(function* () {
      const { port } = yield* serveLoopback({ openHostChannel: brokenHostChannel, port: 0, token: TOKEN });
      const closed = yield* closeOf(`ws://127.0.0.1:${port}/host/abc?token=${TOKEN}`);
      expect(closed.code).toBe(4000);
    }).pipe(Effect.provide(fresh())),
  );
});

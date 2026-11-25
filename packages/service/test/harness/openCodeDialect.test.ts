import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { HarnessEvent } from "../../src/core/index.ts";
import { makeOpenCodeHarness } from "../../src/index.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

// What OpenCode keeps from its own loop now that it runs through the ACP module (acpHarness.ts) as a dialect:
// the facts the module's other checks (acpProtocol.test.ts) and the OpenCode checks beside this one do not pin.

const standIn = [join(import.meta.dirname, "..", "fixtures", "stand-in-opencode.mjs")];

/** An unsandboxed OpenCode over the stand-in, with a folder of its own for the instructions it is given. */
const withOpenCode = <A, E, R>(check: (run: ReturnType<typeof makeRun>) => Effect.Effect<A, E, R>) => {
  const directory = mkdtempSync(join(tmpdir(), "outlore-opencode-dialect-"));
  return Effect.gen(function* () {
    const harness = yield* makeOpenCodeHarness({
      command: process.execPath,
      idleTimeout: "10 minutes",
      instructionsFolder: directory,
      prefixArgs: standIn,
      sandbox: null,
    });
    return yield* check(makeRun(harness));
  }).pipe(
    Effect.scoped,
    Effect.ensuring(
      Effect.sync(() => {
        delete process.env.STAND_IN_OPENCODE_CACHE_WRITE;
        rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 });
      }),
    ),
  );
};

const makeRun = (harness: {
  readonly runTurn: (request: ReturnType<typeof turnRequestOf>) => Effect.Effect<unknown, unknown>;
}) =>
  Effect.fnUntraced(function* (text: string) {
    const events: Array<HarnessEvent> = [];
    const outcome = yield* harness.runTurn(
      turnRequestOf({ onEvent: (event) => Effect.sync(() => events.push(event)), text }),
    );
    return { events, outcome: outcome as { usage: unknown; context: number | null; contextWindow: number | null } };
  });

describe("OpenCode as a dialect of the ACP module", () => {
  it.live("counts the cache writes its prompts report as cache creation, and reads the context from the usage", () => {
    process.env.STAND_IN_OPENCODE_CACHE_WRITE = "5";
    return withOpenCode((run) =>
      Effect.gen(function* () {
        const { outcome } = yield* run("Hello");
        expect(outcome.usage).toEqual({ cacheCreation: 5, cacheRead: 40, input: 90, output: 8 });
        // The context is the whole token total of the prompt, cache writes included.
        expect(outcome.context).toBe(143);
      }),
    );
  });

  it.live("shows no tool call of its own as an event, only the file edits the calls made", () =>
    withOpenCode((run) =>
      Effect.gen(function* () {
        const ran = yield* run("run ls");
        expect(ran.events.filter((event) => event._tag === "ToolCall")).toEqual([]);
        const edited = yield* run("report file changes");
        // The one call that edited a file is reported with its edit, and no other call is.
        const calls = edited.events.filter((event) => event._tag === "ToolCall");
        expect(calls).toHaveLength(1);
        expect(calls[0]).toMatchObject({ fileEdit: { pairs: [{ next: "new\n", previous: "old\n" }] } });
      }),
    ),
  );
});

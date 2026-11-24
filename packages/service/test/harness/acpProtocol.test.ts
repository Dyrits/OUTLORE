import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { HarnessEvent, HarnessPrompt, PromptAnswer } from "../../src/core/index.ts";
import { makeAcpProviderHarness } from "../../src/harness/acpProviders.ts";
import { makeVibeHarness } from "../../src/index.ts";
import {
  type AcpFakeConfig,
  acpFakeEnv,
  acpFakeRequest,
  acpFakeRequests,
  acpFakeScript,
  configSetsLogged,
} from "../fixtures/acpFake.ts";
import { standInHarness } from "../fixtures/providerStandIns.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

// What every ACP harness does the same way, checked once against the harnesses that share it: the generic adapter's
// providers (through the Antigravity and Cursor registry entries, and the bare adapter) and Vibe. The unified ACP module
// owns this behavior; a provider's own facts are its definition and dialect, checked in the provider's own test.

const vibeStandIn = [join(import.meta.dirname, "..", "fixtures", "stand-in-vibe.mjs")];

/** Runs `check` in a fresh folder for the stand-in's log, removed afterwards. */
const inFolder = <A, E, R>(check: (log: string, directory: string) => Effect.Effect<A, E, R>) => {
  const directory = mkdtempSync(join(tmpdir(), "outlore-acp-protocol-"));
  return check(join(directory, "calls"), directory).pipe(
    Effect.scoped,
    Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))),
  );
};

/** A turn of one registry harness over the one ACP stand-in. */
const turnOn = (harness: "antigravity" | "cursor", log: string, config: AcpFakeConfig) =>
  standInHarness(harness, {
    command: process.execPath,
    env: acpFakeEnv(log, config),
    idleTimeout: "10 minutes",
    prefixArgs: [acpFakeScript],
  });

/** The generic adapter without a provider definition: a profile that adds nothing but its label. */
const bareAdapter = (log: string, config: AcpFakeConfig) =>
  makeAcpProviderHarness({
    command: process.execPath,
    idleTimeout: "10 minutes",
    prefixArgs: [acpFakeScript],
    profile: { args: [], env: acpFakeEnv(log, config), label: "fake ACP" },
  });

const edited = (events: ReadonlyArray<HarnessEvent>) =>
  events.filter((event) => event._tag === "ToolCall" && event.fileEdit !== undefined);

describe("every ACP harness reports what its tool calls edited (CHG-0593)", () => {
  it.live("reads a completed ACP diff block of the generic adapter as a file edit", () =>
    inFolder((log) =>
      Effect.gen(function* () {
        const events: Array<HarnessEvent> = [];
        const harness = yield* bareAdapter(log, { diff: true });
        yield* harness.runTurn(
          turnRequestOf({ onEvent: (event) => Effect.sync(() => events.push(event)), text: "edit notes.txt" }),
        );
        expect(edited(events)).toEqual([
          {
            _tag: "ToolCall",
            fileEdit: { pairs: [{ next: "new\n", previous: "old\n" }] },
            // The edit takes the tool call's id, so the Steps entry the call opened is the one that shows the diff.
            id: "call-1",
            input: { file_path: "notes.txt" },
            toolName: "Edit",
          },
        ]);
      }),
    ),
  );

  it.live("reads it for a registry provider too, and for none when the owner denies the call", () =>
    inFolder((log) =>
      Effect.gen(function* () {
        const allowed: Array<HarnessEvent> = [];
        const denied: Array<HarnessEvent> = [];
        const harness = yield* turnOn("cursor", log, { diff: true });
        yield* harness.runTurn(
          turnRequestOf({ onEvent: (event) => Effect.sync(() => allowed.push(event)), text: "edit notes.txt" }),
        );
        yield* harness.runTurn(
          turnRequestOf({
            askOwner: () => Effect.succeed({ isAllowed: false, text: "" }),
            onEvent: (event) => Effect.sync(() => denied.push(event)),
            text: "edit notes.txt",
            threadId: "thread-2",
          }),
        );
        expect(edited(allowed)).toHaveLength(1);
        expect(edited(denied)).toHaveLength(0);
      }),
    ),
  );
});

describe("every ACP harness reports the context window and the turn's usage", () => {
  it.live("reads the `used` of a usage_update as the context, for the generic adapter as Vibe does", () =>
    inFolder((log) =>
      Effect.gen(function* () {
        const harness = yield* bareAdapter(log, { contextUsed: 4321, usage: "update" });
        const outcome = yield* harness.runTurn(turnRequestOf({ text: "run git push" }));
        expect(outcome.context).toBe(4321);
        // The token fields a provider puts in a usage_update stay read as before.
        expect(outcome.usage).toEqual({ cacheCreation: 0, cacheRead: 2, input: 10, output: 5 });
      }),
    ),
  );

  it.live(
    "reads the prompt's own usage, thoughts counted as output, and keeps a cached read apart from the input",
    () =>
      inFolder((log) =>
        Effect.gen(function* () {
          const harness = yield* bareAdapter(log, { usage: "response" });
          const outcome = yield* harness.runTurn(turnRequestOf({ text: "run git push" }));
          // Outlore's usage already carries cache reads beside the input, so adding them to it (as T3 Code does for its own
          // totals) would count them twice in the context and the price.
          expect(outcome.usage).toEqual({ cacheCreation: 0, cacheRead: 2, input: 10, output: 6 });
          expect(outcome.context).toBe(1234);
        }),
      ),
  );

  it.live("reports no context and no usage for a provider that sends neither", () =>
    inFolder((log) =>
      Effect.gen(function* () {
        const harness = yield* bareAdapter(log, { usage: "none" });
        const outcome = yield* harness.runTurn(turnRequestOf({ text: "run git push" }));
        expect(outcome.usage).toEqual({ cacheCreation: 0, cacheRead: 0, input: 0, output: 0 });
        expect(outcome.context ?? null).toBeNull();
      }),
    ),
  );

  it.live("reads Vibe's context from its usage_update and its billing from its account", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-protocol-"));
    process.env.STAND_IN_LOG = join(directory, "log.jsonl");
    return Effect.gen(function* () {
      const harness = yield* makeVibeHarness({
        command: process.execPath,
        idleTimeout: "10 minutes",
        prefixArgs: vibeStandIn,
      });
      const outcome = yield* harness.runTurn(turnRequestOf({ harness: "vibe", text: "Hello" }));
      expect(outcome.context).toBe(1234);
      expect(outcome.billing).toBe("Subscription");
      // The session's totals are cumulative, so the turn's own usage is the first answer whole.
      expect(outcome.usage).toEqual({ cacheCreation: 0, cacheRead: 40, input: 90, output: 8 });
      process.env.STAND_IN_VIBE_PLAN = "api";
      const keyed = yield* harness.runTurn(turnRequestOf({ harness: "vibe", text: "Hello", threadId: "thread-2" }));
      expect(keyed.billing).toBe("ApiKey");
    }).pipe(
      Effect.scoped,
      Effect.ensuring(
        Effect.sync(() => {
          delete process.env.STAND_IN_LOG;
          delete process.env.STAND_IN_VIBE_PLAN;
          rmSync(directory, { force: true, recursive: true });
        }),
      ),
    );
  });
});

describe("every ACP harness sets only the session options the session offered", () => {
  it.live("leaves the thinking level alone when the generic adapter's session offers none", () =>
    inFolder((log) =>
      Effect.gen(function* () {
        const harness = yield* bareAdapter(log, { options: ["model"] });
        yield* harness.runTurn(turnRequestOf({ effort: "high", model: "model-a", text: "Hello" }));
        expect(configSetsLogged(log)).toEqual([["model", "model-a"]]);
      }),
    ),
  );

  it.live("leaves the thinking level alone when Vibe's session offers none, as the generic adapter does", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-protocol-"));
    const log = join(directory, "log.jsonl");
    process.env.STAND_IN_LOG = log;
    process.env.STAND_IN_VIBE_OPTIONS = "mode,model";
    return Effect.gen(function* () {
      const harness = yield* makeVibeHarness({
        command: process.execPath,
        idleTimeout: "10 minutes",
        prefixArgs: vibeStandIn,
      });
      yield* harness.runTurn(
        turnRequestOf({ effort: "low", harness: "vibe", model: "mistral-large-4", text: "Hello" }),
      );
      const sets = acpFakeRequests(log, "session/set_config_option").map((entry) => [
        entry.params?.configId,
        entry.params?.value,
      ]);
      expect(sets).toContainEqual(["model", "mistral-large-4"]);
      expect(sets).not.toContainEqual(["thinking", "low"]);
    }).pipe(
      Effect.scoped,
      Effect.ensuring(
        Effect.sync(() => {
          delete process.env.STAND_IN_LOG;
          delete process.env.STAND_IN_VIBE_OPTIONS;
          rmSync(directory, { force: true, recursive: true });
        }),
      ),
    );
  });

  it.live(
    "keeps every session in the provider's default mode: only `ask` is ever chosen, never yolo or auto_edit",
    () =>
      inFolder((log) =>
        Effect.gen(function* () {
          const harness = yield* turnOn("antigravity", log, { modes: ["default", "yolo", "auto_edit"] });
          yield* harness.runTurn(turnRequestOf({ text: "run git push" }));
          expect(configSetsLogged(log).filter(([id]) => id === "mode")).toEqual([]);
          expect(acpFakeRequests(log, "session/set_mode")).toEqual([]);
        }),
      ),
  );
});

describe("every ACP harness starts as a client that offers no file or terminal tools", () => {
  it.live("advertises neither client file reads nor writes nor a terminal, so agy keeps its diff edits", () =>
    inFolder((log) =>
      Effect.gen(function* () {
        const harness = yield* turnOn("antigravity", log, {});
        yield* harness.runTurn(turnRequestOf({ text: "Hello" }));
        const initialize = acpFakeRequest(log, "initialize").params as {
          clientCapabilities?: { fs?: Record<string, unknown>; terminal?: unknown };
        };
        expect(initialize.clientCapabilities?.fs).toEqual({ readTextFile: false, writeTextFile: false });
        expect(initialize.clientCapabilities?.terminal).toBe(false);
      }),
    ),
  );
});

describe("every ACP harness refuses images an agent says it cannot take", () => {
  const withImage = (directory: string) => {
    const path = join(directory, "picture.png");
    writeFileSync(path, "png");
    return [{ mediaType: "image/png", name: "picture.png", path }] as const;
  };

  it.live("fails the turn naming the provider, for the generic adapter", () =>
    inFolder((log, directory) =>
      Effect.gen(function* () {
        const harness = yield* bareAdapter(log, { images: false });
        const failure = yield* harness
          .runTurn(turnRequestOf({ images: withImage(directory), text: "Look" }))
          .pipe(Effect.flip);
        expect(failure.reason).toContain("fake ACP's agent does not take images");
      }),
    ),
  );

  it.live("fails the turn naming Vibe, for Vibe", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-protocol-"));
    process.env.STAND_IN_VIBE_IMAGES = "false";
    return Effect.gen(function* () {
      const harness = yield* makeVibeHarness({
        command: process.execPath,
        idleTimeout: "10 minutes",
        prefixArgs: vibeStandIn,
      });
      const failure = yield* harness
        .runTurn(turnRequestOf({ harness: "vibe", images: withImage(directory), text: "Look" }))
        .pipe(Effect.flip);
      expect(failure.reason).toContain("Mistral Vibe's agent does not take images");
    }).pipe(
      Effect.scoped,
      Effect.ensuring(
        Effect.sync(() => {
          delete process.env.STAND_IN_VIBE_IMAGES;
          rmSync(directory, { force: true, recursive: true });
        }),
      ),
    );
  });
});

describe("every ACP harness gives the session the thread's tool server", () => {
  it.live("hands Vibe the HTTP server whatever it advertises, since it answers anything else -32602", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-protocol-"));
    const log = join(directory, "log.jsonl");
    process.env.STAND_IN_LOG = log;
    return Effect.gen(function* () {
      const harness = yield* makeVibeHarness({
        command: process.execPath,
        idleTimeout: "10 minutes",
        prefixArgs: vibeStandIn,
      });
      const base = turnRequestOf({ harness: "vibe", text: "Hello" });
      yield* harness.runTurn({ ...base, access: { ...base.access, mcpUrl: "http://127.0.0.1:9/mcp/vibe" } });
      expect(acpFakeRequest(log, "session/new").params?.mcpServers).toEqual([
        { headers: [], name: "outlore", type: "http", url: "http://127.0.0.1:9/mcp/vibe" },
      ]);
    }).pipe(
      Effect.scoped,
      Effect.ensuring(
        Effect.sync(() => {
          delete process.env.STAND_IN_LOG;
          rmSync(directory, { force: true, recursive: true });
        }),
      ),
    );
  });
});

describe("Antigravity opens a known session without replaying it", () => {
  const priorSession = { sessionId: "agy-known" };
  const loadedOrResumed = (log: string) =>
    ["session/load", "session/resume", "session/new"].filter((method) => acpFakeRequests(log, method).length > 0);

  it.live("resumes a session the agent says it can resume, with the folder and tool servers a load takes", () =>
    inFolder((log) =>
      Effect.gen(function* () {
        const harness = yield* turnOn("antigravity", log, { resume: true });
        const outcome = yield* harness.runTurn(turnRequestOf({ ...priorSession, text: "Again" }));
        expect(loadedOrResumed(log)).toEqual(["session/resume"]);
        const params = acpFakeRequest(log, "session/resume").params as Record<string, unknown>;
        expect(params).toMatchObject({ cwd: tmpdir(), sessionId: "agy-known" });
        // Agents answer a missing `mcpServers` with -32602, even when it is empty.
        expect(params.mcpServers).toBeInstanceOf(Array);
        expect(outcome.sessionId).toBe("agy-known");
      }),
    ),
  );

  it.live("loads the session when the agent does not advertise resuming", () =>
    inFolder((log) =>
      Effect.gen(function* () {
        const harness = yield* turnOn("antigravity", log, { resume: false });
        yield* harness.runTurn(turnRequestOf({ ...priorSession, text: "Again" }));
        expect(loadedOrResumed(log)).toEqual(["session/load"]);
      }),
    ),
  );

  it.live("loads the session when resuming fails, and starts a new one with the conversation when that fails too", () =>
    inFolder((log) =>
      Effect.gen(function* () {
        const events: Array<HarnessEvent> = [];
        const harness = yield* turnOn("antigravity", log, { resume: true, resumeFails: true });
        yield* harness.runTurn(turnRequestOf({ ...priorSession, text: "Again" }));
        expect(loadedOrResumed(log)).toEqual(["session/load", "session/resume"]);

        const lostLog = `${log}-lost`;
        const lost = yield* turnOn("antigravity", lostLog, { missingSession: "agy-known", resume: true });
        const outcome = yield* lost.runTurn(
          turnRequestOf({
            ...priorSession,
            conversationSoFar: Effect.succeed("Earlier words."),
            onEvent: (event) => Effect.sync(() => events.push(event)),
            text: "Again",
          }),
        );
        expect(loadedOrResumed(lostLog)).toEqual(["session/load", "session/resume", "session/new"]);
        expect(outcome.sessionId).toBe("acp-1");
        expect(events.some((event) => event._tag === "Notice" && event.text.includes("could not pick up"))).toBe(true);
      }),
    ),
  );

  it.live("leaves every other provider on session/load even when its agent advertises resuming", () =>
    inFolder((log) =>
      Effect.gen(function* () {
        const harness = yield* turnOn("cursor", log, { resume: true });
        yield* harness.runTurn(turnRequestOf({ ...priorSession, text: "Again" }));
        expect(loadedOrResumed(log)).toEqual(["session/load"]);
      }),
    ),
  );
});

describe("Antigravity's interaction requests are questions, not approvals", () => {
  const options = [
    { kind: "allow_once", name: "Use Postgres", optionId: "opt-a" },
    { kind: "allow_once", name: "Use SQLite", optionId: "opt-b" },
  ] as const;
  const question = {
    interaction: true,
    permissionOptions: options,
    tool: { answerPrefix: "question", kind: "other", title: "Which database?" },
  } as const satisfies AcpFakeConfig;

  const asking = (answer: PromptAnswer) => {
    const asked: Array<HarnessPrompt> = [];
    return {
      asked,
      askOwner: (prompt: HarnessPrompt) =>
        Effect.sync(() => {
          asked.push(prompt);
          return answer;
        }),
    };
  };

  it.live("asks the owner to choose among the offered options, and answers with the option they chose", () =>
    inFolder((log) =>
      Effect.gen(function* () {
        const { asked, askOwner } = asking({ answers: [["Use SQLite"]], isAllowed: true, text: "" });
        const events: Array<HarnessEvent> = [];
        const harness = yield* turnOn("antigravity", log, question);
        yield* harness.runTurn(
          turnRequestOf({ askOwner, onEvent: (event) => Effect.sync(() => events.push(event)), text: "Decide" }),
        );
        expect(asked).toHaveLength(1);
        expect(asked[0]?.choices).toEqual([
          {
            allowsOther: false,
            header: "Gemini (Antigravity)",
            multiple: false,
            options: [
              { description: "", label: "Use Postgres" },
              { description: "", label: "Use SQLite" },
            ],
            question: "Which database?",
          },
        ]);
        expect(events.filter((event) => event._tag === "Reply").map((event) => event.text)).toContain(
          "question was opt-b",
        );
      }),
    ),
  );

  it.live("answers cancelled when the owner skips the question, never an option on their behalf", () =>
    inFolder((log) =>
      Effect.gen(function* () {
        const { askOwner } = asking({ isAllowed: false, text: "" });
        const events: Array<HarnessEvent> = [];
        const harness = yield* turnOn("antigravity", log, question);
        yield* harness.runTurn(
          turnRequestOf({ askOwner, onEvent: (event) => Effect.sync(() => events.push(event)), text: "Decide" }),
        );
        expect(events.filter((event) => event._tag === "Reply").map((event) => event.text)).toContain(
          "question was cancelled",
        );
      }),
    ),
  );

  it.live("answers cancelled when the chosen text names no offered option", () =>
    inFolder((log) =>
      Effect.gen(function* () {
        const { askOwner } = asking({ answers: [["Use MySQL"]], isAllowed: true, text: "" });
        const events: Array<HarnessEvent> = [];
        const harness = yield* turnOn("antigravity", log, question);
        yield* harness.runTurn(
          turnRequestOf({ askOwner, onEvent: (event) => Effect.sync(() => events.push(event)), text: "Decide" }),
        );
        expect(events.filter((event) => event._tag === "Reply").map((event) => event.text)).toContain(
          "question was cancelled",
        );
      }),
    ),
  );

  it.live("is asked as an ordinary approval by a provider whose dialect has no such requests", () =>
    inFolder((log) =>
      Effect.gen(function* () {
        const { asked, askOwner } = asking({ isAllowed: true, text: "" });
        const harness = yield* turnOn("cursor", log, question);
        yield* harness.runTurn(turnRequestOf({ askOwner, text: "Decide" }));
        expect(asked).toHaveLength(1);
        expect(asked[0]?.choices).toBeUndefined();
      }),
    ),
  );
});

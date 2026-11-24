import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import type { HarnessEvent } from "../../src/core/index.ts";
import { acpLaunchOf } from "../../src/harness/acpProviderDefinition.ts";
import { readAcpProviderSignIn } from "../../src/harness/acpProviders.ts";
import { antigravity, antigravityGeminiHome } from "../../src/harness/antigravityProvider.ts";
import { standInHarness, standInProbe } from "../fixtures/providerStandIns.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

// Fixture checks of the Antigravity harness against its stand-in, antigravityProviderFake.mjs: the launch always carries
// the same Gemini home in its --gemini-dir flag and environment, the pinned environment suppresses the CLI's
// self-update, and a turn mediates its tool calls through the owner exactly as the generic ACP adapter does.

type LoggedEntry = {
  argv?: string[];
  autoUpdateDisabled?: string | null;
  geminiHome?: string | null;
  method?: string;
  params?: Record<string, unknown>;
  wslDistroName?: string | null;
};

const readEntries = (log: string): Array<LoggedEntry> =>
  readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as LoggedEntry);

const fakeArgs = ["../fixtures/antigravityProviderFake.mjs"] as const;

/** The stand-in's entry for one method, or a failure naming the absent method. */
const entryOf = (log: string, method: string) => {
  const entry = readEntries(log).find((parsed) => parsed.method === method);
  if (entry === undefined) throw new Error(`the stand-in logged no ${method}`);
  return entry;
};

const probeOf = (log: string, geminiHome?: string) =>
  standInProbe(antigravity, {
    env: { ANTIGRAVITY_FAKE_LOG: log },
    ...(geminiHome === undefined ? {} : { configDirectory: geminiHome }),
    prefixArgs: [join(import.meta.dirname, fakeArgs[0])],
  }).pipe(Effect.runPromise);

describe("resolving the Antigravity launch surface", () => {
  it("uses the account's GEMINI_HOME and otherwise the user's .gemini, as upstream does", () => {
    expect(antigravityGeminiHome({ GEMINI_HOME: "/accounts/gemini" })).toBe("/accounts/gemini");
    expect(antigravityGeminiHome({ GEMINI_HOME: "  " }, "/users/eden")).toBe(join("/users/eden", ".gemini"));
    expect(antigravityGeminiHome({}, "/users/eden")).toBe(join("/users/eden", ".gemini"));
  });

  it("launches in exactly the pinned argv order: acp, the home flag, the app-data flag", () => {
    expect(acpLaunchOf(antigravity, { configDirectory: "/gemini-home" }).args).toEqual([
      "acp",
      "--gemini-dir=/gemini-home",
      "--app-data-dir=antigravity-acp",
    ]);
  });
});

describe("probing the Antigravity CLI", () => {
  it("reads the session's models with the pinned argv and environment against the given home", async () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-antigravity-probe-"));
    const geminiHome = join(directory, "gemini-home");
    const log = join(directory, "calls");
    try {
      const models = await probeOf(log, geminiHome);
      expect(models).toEqual([{ id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" }]);
      await vi.waitFor(() => expect(readFileSync(log, "utf8")).toContain('"exit":true'));
      const entry = entryOf(log, "session/new");
      expect(entry.argv).toEqual(["acp", `--gemini-dir=${geminiHome}`, "--app-data-dir=antigravity-acp"]);
      // The two home channels never disagree: the flag and the environment carry the same home.
      expect(entry.geminiHome).toBe(geminiHome);
      expect(entry.autoUpdateDisabled).toBe("true");
      // No WSL distro name: it would move the CLI's tokens from the keychain, where its own login stores them, to a file.
      expect(entry.wslDistroName).toBeNull();
      expect(entry.params?.mcpServers).toEqual([]);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("resolves the home from the process's GEMINI_HOME when none is given", async () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-antigravity-default-"));
    const log = join(directory, "calls");
    const previous = process.env.GEMINI_HOME;
    process.env.GEMINI_HOME = join(directory, "env-home");
    try {
      const models = await probeOf(log);
      expect(models).toEqual([{ id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" }]);
      await vi.waitFor(() => expect(readFileSync(log, "utf8")).toContain('"exit":true'));
      const entry = entryOf(log, "session/new");
      expect(entry.argv).toContain(`--gemini-dir=${join(directory, "env-home")}`);
      expect(entry.geminiHome).toBe(join(directory, "env-home"));
    } finally {
      if (previous === undefined) delete process.env.GEMINI_HOME;
      else process.env.GEMINI_HOME = previous;
      rmSync(directory, { force: true, recursive: true });
    }
  });
});

describe("reading the Antigravity sign-in", () => {
  const signInOf = (mode: string, command = "node") => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-antigravity-signin-"));
    return readAcpProviderSignIn({
      command,
      definition: antigravity,
      env: { ANTIGRAVITY_FAKE_LOG: join(directory, "calls"), ANTIGRAVITY_FAKE_MODE: mode },
      prefixArgs: [join(import.meta.dirname, fakeArgs[0])],
    }).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))), Effect.runPromise);
  };

  it("reads a session that lists models as signed in", async () => {
    expect(await signInOf("probe")).toEqual({ detail: null, signIn: "SignedIn" });
  });

  it("reads the authentication error answer as signed out", async () => {
    expect(await signInOf("signedout")).toEqual({ detail: null, signIn: "SignedOut" });
  });

  it("reads a CLI that cannot start as unknown", async () => {
    expect(await signInOf("probe", "outlore-no-such-antigravity")).toEqual({ detail: null, signIn: "Unknown" });
  });
});

describe("running a thread on the Antigravity CLI", () => {
  // The registry's Antigravity entry resolves its pinned home from the process's GEMINI_HOME, as in the app.
  afterEach(() => vi.unstubAllEnvs());
  const harnessOf = (log: string, geminiHome: string) => {
    vi.stubEnv("GEMINI_HOME", geminiHome);
    return standInHarness("antigravity", {
      env: { ANTIGRAVITY_FAKE_LOG: log, ANTIGRAVITY_FAKE_MODE: "turn" },
      idleTimeout: "10 minutes",
      prefixArgs: [join(import.meta.dirname, fakeArgs[0])],
    });
  };

  it.live("mediates a tool permission request the owner allows", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-antigravity-turn-"));
    const geminiHome = join(directory, "gemini-home");
    const log = join(directory, "calls");
    const events: Array<HarnessEvent> = [];
    return Effect.gen(function* () {
      const harness = yield* harnessOf(log, geminiHome);
      const outcome = yield* harness.runTurn(
        turnRequestOf({ onEvent: (event) => Effect.sync(() => events.push(event)), text: "run git push" }),
      );
      expect(outcome.isInterrupted).toBe(false);
      expect(events.filter((event) => event._tag === "Reply").map((event) => event.text)).toEqual([
        "Working",
        "tool was allow_once",
      ]);
      expect(events).toContainEqual({
        _tag: "ToolCall",
        id: "call-1",
        input: { command: "git push origin main" },
        toolName: "git push",
      });
      const entry = entryOf(log, "session/prompt");
      expect(entry.argv).toEqual(["acp", `--gemini-dir=${geminiHome}`, "--app-data-dir=antigravity-acp"]);
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("answers a denial with the provider's reject option and carries the turn on", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-antigravity-turn-"));
    const log = join(directory, "calls");
    const events: Array<HarnessEvent> = [];
    return Effect.gen(function* () {
      const harness = yield* harnessOf(log, join(directory, "gemini-home"));
      const outcome = yield* harness.runTurn(
        turnRequestOf({
          askOwner: () => Effect.succeed({ isAllowed: false, text: "" }),
          onEvent: (event) => Effect.sync(() => events.push(event)),
          text: "run git push",
        }),
      );
      expect(outcome.isInterrupted).toBe(false);
      expect(events.filter((event) => event._tag === "Reply").map((event) => event.text)).toEqual([
        "Working",
        "tool was reject_once",
      ]);
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });
});

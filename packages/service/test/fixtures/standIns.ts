import { mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { type HarnessName, harnessNames, type MissionDetail } from "@outlore/contracts";
import { type Duration, Effect, Layer } from "effect";
import { afterEach } from "vitest";
import type { OpenCodeSandbox } from "../../src/harness/openCodeSandbox.ts";
import { type FakeUpdates, fakeHarnessToolsLayer, Harness, makeHarnessRouter, serviceLayer } from "../../src/index.ts";
import { type AcpFakeConfig, acpFakeEnv, acpFakeScript } from "./acpFake.ts";
import { call, temporary } from "./service.ts";

/** The controls the stand-in harnesses read; each is cleared after every test that could have set it. */
const standInControls = [
  "STAND_IN_LOG",
  "STAND_IN_MODE",
  "STAND_IN_COST",
  "STAND_IN_API_KEY_SOURCE",
  "STAND_IN_MODEL",
  "STAND_IN_INPUT",
  "STAND_IN_CONTEXT_WINDOW",
  "STAND_IN_COMPACT",
  "STAND_IN_CODEX_ACCOUNT",
  "STAND_IN_CODEX_LIMITS",
  "STAND_IN_CODEX_START_DELAY",
  "STAND_IN_OPENCODE_IMAGES",
  "STAND_IN_OPENCODE_LIMITS",
  "STAND_IN_OPENCODE_CHILD",
  "STAND_IN_OPENCODE_EXECUTOR",
  "STAND_IN_OPENCODE_MISSING_SESSIONS",
  "PI_FAKE_LOG",
  "PI_FAKE_MODE",
  "PI_FAKE_SESSION",
  "PI_FAKE_MISSING_SESSION",
  "PI_FAKE_UI_QUESTION",
  "PI_FAKE_TOOL_BREACH",
  "PI_FAKE_REFUSE_PROMPT",
  "PI_FAKE_SLOW",
  "ACP_FAKE",
  "ACP_FAKE_LOG",
];
afterEach(() => {
  for (const name of standInControls) delete process.env[name];
});

/** One line of the stand-ins' shared log. */
export type Logged = {
  /** The argv and watched environment of an ACP stand-in's process (acpFake.mjs). */
  readonly launch?: { readonly argv: ReadonlyArray<string>; readonly env: Record<string, string | null> };
  readonly args?: ReadonlyArray<string>;
  readonly auth?: string;
  readonly config?: Record<string, unknown>;
  readonly cwd?: string;
  readonly data?: string;
  readonly env?: ReadonlyArray<string>;
  readonly executor?: number;
  readonly grandchild?: number;
  readonly home?: unknown;
  readonly method?: string;
  readonly params?: Record<string, unknown>;
  readonly pid?: number;
  readonly pwd?: string | null;
  readonly xdg?: Record<string, string | null>;
};

/** Folders standing for the computer's own OpenCode configuration and data, outside every writable folder. */
export const realHomes = () => realpathSync(temporary("outlore-real-"));

/** Seatbelt as the service sets it up, with the computer's own folders in `real`. */
export const seatbeltIn = (real: string) => (root: string) =>
  ({
    // The checks' own log sits in the temporary folder, so it is a writable cache here.
    caches: [root],
    command: "/usr/bin/sandbox-exec",
    computerConfigHome: join(real, "config"),
    computerDataHome: join(real, "share"),
    hidden: [],
    kind: "seatbelt",
    root: join(root, "opencode-sandbox"),
  }) as const;

/** A Seatbelt sandbox typed for the wrapper's argument tests. */
export const seatbelt: OpenCodeSandbox = {
  caches: ["/caches/bun"],
  command: "/usr/bin/sandbox-exec",
  computerConfigHome: "/home/me/.config",
  computerDataHome: "/home/me/.local/share",
  hidden: [],
  kind: "seatbelt",
  root: "/state/opencode",
};

/** The same sandbox under bubblewrap. */
export const bwrap: OpenCodeSandbox = { ...seatbelt, command: "/usr/bin/bwrap", kind: "bwrap" };

/** Whether a process is still alive. */
export const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** Waits until the check holds, polling every 25 ms. */
export const waitFor = async (check: () => boolean, millis = 5000) => {
  for (let waited = 0; waited < millis && !check(); waited += 25)
    await new Promise((resolve) => setTimeout(resolve, 25));
  return check();
};

/** The stand-in a harness runs in its executable's place, by file name in this folder. */
const standInScript = (name: string) => join(import.meta.dirname, name);

/** The one configurable ACP stand-in as a provider's launch: its environment (logging to the shared log) and script. */
const acpStandIn = (log: string, config: AcpFakeConfig = {}) => ({
  env: acpFakeEnv(log, { logEnv: ["GEMINI_HOME", "AGY_CLI_DISABLE_AUTO_UPDATE"], ...config }),
  prefixArgs: [acpFakeScript],
});

/**
 * A service whose harnesses all run stand-ins, logging to one file; OpenCode wrapped when a sandbox is given.
 * The router is the app's own (`makeHarnessRouter`): every harness starts from its registry entry, so what the registry adds around a launch (Muse's update flag, Antigravity's pinned home, the tool-server wiring) happens here too, and only the executable is a stand-in.
 */
export const withHarnesses = (
  idleTimeout: Duration.Input = "10 minutes",
  openCodeSandbox: (directory: string) => OpenCodeSandbox | null = () => null,
) => {
  const directory = realpathSync(temporary("outlore-harnesses-"));
  const log = join(directory, "log.jsonl");
  process.env.STAND_IN_LOG = log;
  const signIns: Array<string> = [];
  const updates: FakeUpdates = { available: {}, updated: [] };
  const missing = new Set<HarnessName>();
  const accountsRoot = join(directory, "accounts");
  const harness = Layer.effect(
    Harness,
    makeHarnessRouter(
      // Every stand-in is a script run by Node, so one executable serves them all.
      Object.fromEntries(harnessNames.map((name) => [name, process.execPath])) as Record<HarnessName, string>,
      { idleTimeout, sandboxProblem: null },
      {
        // Added accounts stay refused for Antigravity pending the live flag-vs-env check, so its fake runs the computer's own Gemini home.
        antigravity: acpStandIn(log, { usage: "update" }),
        claude: {
          prefixArgs: [standInScript("stand-in-claude.mjs")],
          userSettingsPath: join(directory, "no-settings.json"),
        },
        cline: acpStandIn(log, { usage: "update" }),
        codex: { prefixArgs: [standInScript("stand-in-codex.mjs")] },
        copilot: acpStandIn(log),
        cursor: acpStandIn(log),
        devin: acpStandIn(log, { usage: "update" }),
        // The same stand-in is Hermes; its account-home requirement stands, so only threads with an account folder use it.
        hermes: acpStandIn(log, { modes: ["ask", "default"], options: ["model", "thinking"], usage: "update" }),
        muse: { env: { MUSE_FAKE_LOG: log }, prefixArgs: [standInScript("museProviderFake.mjs")] },
        opencode: {
          instructionsFolder: join(directory, "instructions"),
          openCodeSandbox: openCodeSandbox(directory),
          prefixArgs: [standInScript("stand-in-opencode.mjs")],
        },
        // A turn host from the start; its models stay a probe the fake answers as when asked.
        pi: { env: { PI_FAKE_LOG: log, PI_FAKE_MODE: "turn" }, prefixArgs: [standInScript("piProviderFake.mjs")] },
        vibe: { prefixArgs: [standInScript("stand-in-vibe.mjs")] },
      },
    ),
  );
  const layer = serviceLayer({
    accountsRoot,
    filename: join(directory, "outlore.sqlite"),
    harness,
    harnessTools: fakeHarnessToolsLayer(signIns, updates, missing),
    homeFolder: directory,
    scratchRoot: join(directory, "missions"),
  });
  const logged = (): Array<Logged> => {
    try {
      return readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  };
  const requests = (method: string) => logged().filter((entry) => entry.method === method);
  return { accountsRoot, directory, layer, logged, missing, requests, signIns, updates };
};

/** The stand-in harness's replies to the owner, in order. */
export const replies = (detail: MissionDetail) =>
  detail.messages
    .filter((message) => message.sender === "agent" && message.replyToMessageId == null)
    .map((message) => message.text);

/** A file that starts like a PNG, which is all the service checks. */
export const pngBytes = () =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20, 1)]);

/** Adds a PNG attachment and returns its card. */
export const attachedPng = () => call({ _tag: "AddAttachment", data: pngBytes().toString("base64"), name: "shot.png" });

/** Settled idle with exactly `count` stand-in replies. */
export const idleWith = (count: number) => (detail: MissionDetail) =>
  detail.thread.state === "Resting" && replies(detail).length === count;

/**
 * Waits until the stand-in harness has received `method`. A thread reads Running while its harness process still starts,
 * and an interrupt or a steered message sent then finds no turn to act on, so a test sends one only once the turn is under way.
 */
export const untilRequested = (requests: (method: string) => ReadonlyArray<unknown>, method: string) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 500 && requests(method).length < 1; attempt++) yield* Effect.sleep("10 millis");
    if (requests(method).length < 1) return yield* Effect.die(new Error(`the harness never received ${method}`));
  });

/** The first open question, once one is asked. */
export const openQuestionOf = () =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 300; attempt++) {
      const [question] = yield* call({ _tag: "ListOpenQuestions" });
      if (question !== undefined) return question;
      yield* Effect.sleep("20 millis");
    }
    return yield* Effect.die(new Error("no question was asked"));
  });

/** Answers the first open question with `answer`, failing the test when none was asked. */
export const answerOpen = (answer: "Allow" | "Deny", message: string | null = null) =>
  Effect.gen(function* () {
    const question = yield* openQuestionOf();
    return yield* call({ _tag: "AnswerQuestion", answer, message, questionId: question.id });
  });

/** The process starts of a Claude Code or Codex stand-in, in order. */
export const startsOf = (logged: () => Array<Logged>) => logged().filter((entry) => entry.pid !== undefined);

/** The folder a harness was started in, as the adapter gave it: Claude Code's process, Codex's thread settings too. */
export const startedFolderOf = (harness: "claude" | "codex", logged: () => Array<Logged>, index: number) => {
  const pwd = startsOf(logged)[index]?.pwd;
  if (harness === "claude") return pwd;
  const settings = logged().filter((entry) => entry.method === "thread/start" || entry.method === "thread/resume");
  const cwd = settings[index]?.params?.cwd;
  return pwd === cwd ? pwd : `process ${pwd}, thread ${String(cwd)}`;
};

/** The process ids of the `opencode acp` stand-ins started, in order. */
export const acpPidsOf = (logged: () => Array<Logged>) =>
  logged()
    .filter((entry) => entry.pid !== undefined && entry.args?.includes("acp"))
    .map((entry) => entry.pid);

/** A workspace folder in its own temporary folder, and a folder outside it, both real paths. */
export const linkedFolders = () => {
  const base = realpathSync(temporary("outlore-linked-"));
  const workspace = join(base, "workspace");
  const elsewhere = join(base, "elsewhere");
  mkdirSync(workspace);
  mkdirSync(elsewhere);
  return { elsewhere, workspace };
};

/** Replaces a folder with a link to the target. */
export const linkInPlace = (folder: string, target: string) => {
  rmSync(folder, { force: true, recursive: true });
  symlinkSync(target, folder);
};

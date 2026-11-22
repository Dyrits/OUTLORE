import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EffortChoice, HarnessName, ModelOption, SignInState } from "@outlore/contracts";
import { Clock, Context, Effect, Layer } from "effect";
import { fieldOf, invalid, runShortCommand, type ServiceFailure, textFieldOf } from "../core/index.ts";
import { accountEnvironmentOf, type HarnessFacts, harnessFacts } from "./harnessCatalog.ts";
import { harnesses } from "./harnesses.ts";
import { installHarnessPackage, updateTimeoutMillis } from "./harnessInstallation.ts";
import { updateOf } from "./harnessVersions.ts";

// What Outlore asks each harness's own command-line tool about itself: its version, who is signed in,
// and its models; and how the owner signs in, always through the tool's own sign-in (requirements, Comply
// with provider terms). Outlore never reads or stores the credentials.

/** Who a harness says is signed in to one account's folder. */
export type SignInStatus = {
  readonly detail: string | null;
  readonly signIn: SignInState;
};

/** A harness's installed version, or why it cannot run. */
export type Installation = {
  readonly problem: string | null;
  readonly version: string | null;
};

/** The seam to the harnesses' own tools for everything but turns. */
export class HarnessTools extends Context.Service<
  HarnessTools,
  {
    readonly inspect: (harness: HarnessName) => Effect.Effect<Installation>;
    /** Installs the harness's official npm package. */
    readonly install: (harness: HarnessName) => Effect.Effect<void, ServiceFailure>;
    /** The newer version a harness can update to, given its installed version text; null when up to date or unknown. */
    readonly findUpdate: (harness: HarnessName, installed: string | null) => Effect.Effect<string | null>;
    readonly listModels: (
      harness: HarnessName,
      configDirectory: string | null,
    ) => Effect.Effect<ReadonlyArray<ModelOption>>;
    /**
     * The effort levels the provider offers for one model, lowest first, without "default"; empty when none. Fails when
     * the provider could not be asked, so that a failed read is not taken for a model without levels.
     */
    readonly listEfforts: (
      harness: HarnessName,
      configDirectory: string | null,
      model: string,
    ) => Effect.Effect<ReadonlyArray<EffortChoice>, ServiceFailure>;
    /**
     * Runs the harness's own sign-in, pointed at the account's folder. Where the sign-in needs no terminal it runs in
     * the background, the harness opening the browser itself, and this waits until it ends ("Finished") or fails.
     * Otherwise it opens a terminal window that closes itself on success and returns at once ("Opened").
     */
    readonly openSignIn: (
      harness: HarnessName,
      configDirectory: string | null,
    ) => Effect.Effect<"Finished" | "Opened", ServiceFailure>;
    readonly readSignIn: (harness: HarnessName, configDirectory: string | null) => Effect.Effect<SignInStatus>;
    /** Runs the harness's own update command, which updates it the way it was installed. */
    readonly update: (harness: HarnessName) => Effect.Effect<void, ServiceFailure>;
  }
>()("outlore/HarnessTools") {}

/** The executable each harness runs as. */
export type HarnessCommands = Record<HarnessName, string>;

/** Single-quoted for a POSIX shell. */
const quoted = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;

/** How long a sign-in that needs no terminal may wait for the owner in the browser before it is ended. */
export const signInTimeoutMillis = 5 * 60 * 1000;

/**
 * The script a terminal window runs for a sign-in that needs one. The window closes itself, by the tty it runs on,
 * only when the sign-in succeeded; a failure leaves it open with the reason. Terminal closes its own window, so no
 * other application is controlled (not checked on a Mac: the sandbox blocks osascript).
 */
export const terminalSignInScript = (options: {
  readonly command: string;
  readonly environment: ReadonlyArray<string>;
  readonly label: string;
  readonly path: string;
}) =>
  [
    "#!/bin/sh",
    `echo ${quoted(`Signing in to ${options.label} for Outlore. This window closes when you are signed in.`)}`,
    ...options.environment.map((line) => `export ${line}`),
    `rm -f ${quoted(options.path)}`,
    options.command,
    "status=$?",
    'if [ "$status" -eq 0 ]; then',
    "  tty_name=$(tty)",
    `  (sleep 1; osascript -e "tell application "Terminal" to close (every window whose tty is "$tty_name")" >/dev/null 2>&1) &`,
    "else",
    `  echo ${quoted("Sign-in did not finish. You can close this window.")}`,
    "fi",
    'exit "$status"',
    "",
  ].join("\n");

/** How long a model list is reused before the harness is asked again. */
const modelsLifetimeMillis = 10 * 60 * 1000;

/** How many models' effort levels are read ahead at once. */
const effortWarmingConcurrency = 2;

/** How long the newest release is reused before the registry is asked again. */
const latestLifetimeMillis = 30 * 60 * 1000;

/** Where each registry publishes a package's newest release, and where in its answer the version is. */
const releaseRegistries = {
  // The npm registry's `latest` tag.
  npm: {
    urlOf: (packageName: string) => `https://registry.npmjs.org/${packageName}/latest`,
    versionOf: (body: unknown) => textFieldOf(body, "version"),
  },
  // PyPI's JSON API, for a Python package (Vibe).
  pypi: {
    urlOf: (packageName: string) => `https://pypi.org/pypi/${packageName}/json`,
    versionOf: (body: unknown) => textFieldOf(fieldOf(body, "info"), "version"),
  },
} as const satisfies Record<
  Exclude<HarnessFacts["releaseRegistry"], "none">,
  { readonly urlOf: (packageName: string) => string; readonly versionOf: (body: unknown) => string | null }
>;

/** Reads each tool's own status command; nothing here sees a credential. */
export const liveHarnessToolsLayer = (commands: HarnessCommands, runUpdate: typeof runShortCommand = runShortCommand) =>
  Layer.sync(HarnessTools, () => {
    const models = new Map<string, { readonly at: number; readonly options: ReadonlyArray<ModelOption> }>();

    const inspect = (harness: HarnessName) =>
      runShortCommand(commands[harness], ["--version"], {}).pipe(
        Effect.map(({ code, stdout }): Installation => {
          const version = stdout.trim().split("\n")[0] ?? "";
          return code === 0 && version !== ""
            ? { problem: null, version }
            : {
                problem: `${harnessFacts[harness].label} was not found at "${commands[harness]}". Choose Install, or install it yourself and press Refresh.`,
                version: null,
              };
        }),
      );

    const latest = new Map<HarnessName, { readonly at: number; readonly version: string | null }>();

    // The harness's package registry; any failure reads as "not known", so an offline computer sees no update.
    const readLatest = (harness: HarnessName) => {
      const facts = harnessFacts[harness];
      // A harness from its own source reports no registry version: no update is ever known from here; its own
      // `hermes update --check` remains the source of truth for Hermes.
      if (facts.releaseRegistry === "none") return Effect.succeed<string | null>(null);
      const registry = releaseRegistries[facts.releaseRegistry];
      return Effect.tryPromise(async () => {
        const response = await fetch(registry.urlOf(facts.packageName), { signal: AbortSignal.timeout(8000) });
        const body: unknown = await response.json();
        return response.ok ? registry.versionOf(body) : null;
      }).pipe(Effect.catch(() => Effect.succeed(null)));
    };

    const findUpdate = Effect.fnUntraced(function* (harness: HarnessName, installed: string | null) {
      const now = yield* Clock.currentTimeMillis;
      const cached = latest.get(harness);
      if (cached !== undefined && now - cached.at < latestLifetimeMillis) return updateOf(installed, cached.version);
      const version = yield* readLatest(harness);
      // A failed read is not kept, so the next listing asks again.
      if (version !== null) latest.set(harness, { at: now, version });
      return updateOf(installed, version);
    });

    const update = Effect.fnUntraced(function* (harness: HarnessName) {
      const facts = harnessFacts[harness];
      const label = facts.label;
      // A harness with no update command of its own (Muse: the CLI has none, and Outlore keeps its
      // self-update suppressed) never runs anything here; its releases come by reinstall.
      if (facts.updateArgs === null)
        return yield* invalid(
          `${label} has no update command: reinstall it from its own release channel, then press Refresh.`,
        );
      const run = yield* runUpdate(facts.updateCommand ?? commands[harness], facts.updateArgs, {}, updateTimeoutMillis);
      if (run.code !== 0) {
        const reason = run.output.trim().split("\n").slice(-3).join(" ");
        return yield* invalid(
          `${label} did not update${run.code === null ? " (it timed out or could not run)" : ""}. ${reason}`.trim(),
        );
      }
    });

    const readSignIn = (harness: HarnessName, configDirectory: string | null) =>
      harnesses[harness].readSignIn(commands[harness], accountEnvironmentOf(harness, configDirectory));

    const readModels = (harness: HarnessName, configDirectory: string | null) =>
      harnesses[harness].readModels(commands[harness], configDirectory);

    const listModels = (
      harness: HarnessName,
      configDirectory: string | null,
    ): Effect.Effect<ReadonlyArray<ModelOption>> =>
      Effect.gen(function* () {
        const key = `${harness}:${configDirectory ?? ""}`;
        const now = yield* Clock.currentTimeMillis;
        const cached = models.get(key);
        if (cached !== undefined && now - cached.at < modelsLifetimeMillis) return cached.options;
        const options = yield* readModels(harness, configDirectory);
        // A list with only the default is not kept, so a harness signed in later lists its models at once.
        if (options.length > 1) {
          models.set(key, { at: now, options });
          // A harness whose list does not hold the levels has them read ahead, so a pick shows them at once.
          if (harnesses[harness].readEfforts !== undefined)
            yield* Effect.forkDetach(
              warmEfforts(
                harness,
                configDirectory,
                options.map((option) => option.id),
              ),
            );
        }
        return options;
      });

    const efforts = new Map<string, { at: number; levels: ReadonlyArray<EffortChoice> }>();
    const listEfforts = (
      harness: HarnessName,
      configDirectory: string | null,
      model: string,
    ): Effect.Effect<ReadonlyArray<EffortChoice>, ServiceFailure> =>
      Effect.gen(function* () {
        const readEfforts = harnesses[harness].readEfforts;
        if (readEfforts === undefined)
          return (yield* listModels(harness, configDirectory)).find((option) => option.id === model)?.efforts ?? [];
        const key = `${harness}:${configDirectory ?? ""}:${model}`;
        const now = yield* Clock.currentTimeMillis;
        const cached = efforts.get(key);
        if (cached !== undefined && now - cached.at < modelsLifetimeMillis) return cached.levels;
        const levels = yield* readEfforts(commands[harness], configDirectory, model);
        // An empty answer is not kept either, so the next pick asks again.
        if (levels.length > 0) efforts.set(key, { at: now, levels });
        return levels;
      });

    // The models whose levels are being read ahead, so one list read starts one warming.
    const warming = new Set<string>();

    // Reads each model's effort levels into the same cache a pick uses, a few at a time (each read is a short ACP
    // session); a model that is already kept, or one that fails, is left to the on-demand request.
    const warmEfforts = (
      harness: HarnessName,
      configDirectory: string | null,
      ids: ReadonlyArray<string>,
    ): Effect.Effect<void> =>
      Effect.gen(function* () {
        const prefix = `${harness}:${configDirectory ?? ""}`;
        if (warming.has(prefix)) return;
        warming.add(prefix);
        yield* Effect.forEach(
          ids.filter((id) => id !== "default"),
          (id) => listEfforts(harness, configDirectory, id).pipe(Effect.ignore),
          { concurrency: effortWarmingConcurrency, discard: true },
        ).pipe(Effect.ensuring(Effect.sync(() => warming.delete(prefix))));
      });

    const openSignIn = Effect.fnUntraced(function* (harness: HarnessName, configDirectory: string | null) {
      const facts = harnessFacts[harness];
      if (facts.signInArgs === null)
        return yield* invalid(
          `${facts.label} has no sign-in command of its own: its sign-in happens inside the provider's own surface (the pinned upstream carries no CLI sign-in to run). Sign in there yourself, then press Refresh.`,
        );
      const command = [quoted(commands[harness]), ...facts.signInArgs].join(" ");
      const variable = facts.configVariable;
      // The sign-in's own environment - an auto-update squeeze or a link-flow flag - rides along on both paths,
      // exactly as the pinned upstream launches the sign-in; a turn never carries it. (Read through the full
      // facts record: most harnesses pin none, so the per-harness literal types carry no `signInEnv` at all.)
      const extraEnv = (harnessFacts as Record<HarnessName, HarnessFacts>)[harness].signInEnv ?? {};
      const envEntries = (directory: string | null): Array<readonly [string, string]> => [
        ...(directory === null ? [] : ([[variable, directory]] as const)),
        ...Object.entries(extraEnv),
      ];
      const line =
        configDirectory === null && envEntries(configDirectory).length === 0
          ? command
          : `${envEntries(configDirectory)
              .map(([name, value]) => `${name}=${quoted(value)}`)
              .join(" ")} ${command}`;
      if (process.platform !== "darwin") return yield* invalid(`Open a terminal on this computer and run: ${line}`);
      if (facts.signInNeedsNoTerminal) {
        // No window: the tool opens the browser itself and ends once the browser's answer reaches its local port.
        const run = yield* runShortCommand(
          commands[harness],
          facts.signInArgs,
          { ...accountEnvironmentOf(harness, configDirectory), ...extraEnv },
          signInTimeoutMillis,
        );
        if (run.code !== 0) {
          const reason = run.output.trim().split("\n").slice(-3).join(" ");
          return yield* invalid(
            `${facts.label} did not sign in${run.code === null ? ` (it timed out after ${signInTimeoutMillis / 60_000} minutes or could not run)` : ""}. ${reason}`.trim(),
          );
        }
        return "Finished" as const;
      }
      // A .command file opens in Terminal, which runs the harness's own sign-in where the owner answers it.
      const folder = join(tmpdir(), "outlore-sign-in");
      const script = join(folder, `${harness}-${crypto.randomUUID()}.command`);
      yield* Effect.sync(() => {
        mkdirSync(folder, { recursive: true });
        writeFileSync(
          script,
          terminalSignInScript({
            command,
            environment: envEntries(configDirectory).map(([name, value]) => `${name}=${quoted(value)}`),
            label: facts.label,
            path: script,
          }),
        );
        chmodSync(script, 0o755);
      });
      const opened = yield* runShortCommand("open", [script], {});
      if (opened.code !== 0) return yield* invalid(`Could not open a terminal. Run this yourself: ${line}`);
      return "Opened" as const;
    });

    return {
      findUpdate,
      inspect,
      install: installHarnessPackage,
      listEfforts,
      listModels,
      openSignIn,
      readSignIn,
      update,
    };
  });

/** Which harnesses the fake offers an update to, by newer version, and the harnesses it has updated since. */
export type FakeUpdates = {
  readonly available: Partial<Record<HarnessName, string>>;
  readonly updated: Array<HarnessName>;
};

/** Every harness installed and signed in, with fixed models and no update; sign-ins and updates are recorded, for checks. */
export const fakeHarnessToolsLayer = (
  signIns: Array<string> = [],
  updates: FakeUpdates = { available: {}, updated: [] },
  missing: Set<HarnessName> = new Set(),
) =>
  Layer.succeed(HarnessTools, {
    findUpdate: (harness) => Effect.succeed(updates.available[harness] ?? null),
    inspect: (harness) =>
      Effect.succeed(
        missing.has(harness) ? { problem: "Not installed", version: null } : { problem: null, version: "fake" },
      ),
    install: (harness) =>
      Effect.sync(() => {
        missing.delete(harness);
      }),
    listEfforts: (harness, _configDirectory, model) =>
      Effect.succeed(harnessFacts[harness].fixedModels?.find((option) => option.id === model)?.efforts ?? []),
    listModels: (harness) =>
      Effect.succeed(
        harnessFacts[harness].fixedModels ?? [{ id: `${harness}-fake-model`, label: `${harness} fake model` }],
      ),
    openSignIn: (harness, configDirectory) =>
      Effect.sync(() => {
        signIns.push(`${harness}:${configDirectory ?? ""}`);
        return harnessFacts[harness].signInNeedsNoTerminal ? ("Finished" as const) : ("Opened" as const);
      }),
    readSignIn: (_harness, configDirectory) =>
      Effect.succeed({
        detail: configDirectory === null ? "owner" : "added",
        signIn: "SignedIn",
      } satisfies SignInStatus),
    update: (harness) =>
      Effect.sync(() => {
        updates.updated.push(harness);
        delete updates.available[harness];
      }),
  });

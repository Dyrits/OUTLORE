import type { EffortChoice, HarnessName, ModelOption } from "@outlore/contracts";
import { Clock, Effect, Layer } from "effect";
import { fieldOf, invalid, runShortCommand, type ServiceFailure, textFieldOf } from "../core/index.ts";
import { type HarnessFacts, harnessFacts } from "./harnessCatalog.ts";
import { harnesses } from "./harnesses.ts";
import { installHarnessPackage, updateTimeoutMillis } from "./harnessInstallation.ts";
import { type HarnessCommands, HarnessTools, type Installation, signInTimeoutMillis } from "./harnessTools.ts";
import { updateOf } from "./harnessVersions.ts";

/** Single-quoted for a POSIX shell. */
const quoted = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;

/** One word of a sign-in line: left bare when a shell reads it as itself, quoted otherwise; `&&` chains two commands on purpose. */
const shellWord = (text: string) => (text === "&&" || /^[\w@%+=:,./-]+$/u.test(text) ? text : quoted(text));

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
          const facts = harnessFacts[harness];
          const version = stdout.trim().split("\n")[0] ?? "";
          if (code !== 0 || version === "")
            return {
              problem: `${facts.label} was not found at "${commands[harness]}". Choose Install, or install it yourself and press Refresh.`,
              version: null,
            };
          // A provider is audited against one generation: an older binary runs, but not the way the audit says it does.
          if (facts.versionGate !== null && !facts.versionGate.accepts(version))
            return {
              problem: `${facts.label} reports "${version}", but Outlore supports ${facts.versionGate.expects}. Choose Install to get a supported version, then press Refresh.`,
              version,
            };
          return { problem: null, version };
        }),
      );

    const latest = new Map<HarnessName, { readonly at: number; readonly version: string | null }>();

    // The harness's package registry; any failure reads as "not known", so an offline computer sees no update.
    const readLatest = (harness: HarnessName) => {
      const facts = harnessFacts[harness];
      // A harness from its own source reports no registry version: no update is ever known from here; its own `hermes update --check` remains the source of truth for Hermes.
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
      // A harness with no update command of its own (Muse: the CLI has none, and Outlore keeps its self-update suppressed) never runs anything here; its releases come by reinstall.
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
      harnesses[harness].readSignIn(commands[harness], configDirectory);

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

    // Reads each model's effort levels into the same cache a pick uses, a few at a time; a model that is already kept, or one that fails, is left to the on-demand request.
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
      // The sign-in's own environment rides along on both paths; for an ACP provider it is built from the same definition as the launch, so what the sign-in stores is what a turn reads.
      const signIn = facts.signIn(configDirectory);
      if (signIn === null)
        return yield* invalid(
          `${facts.label} has no sign-in command of its own: its sign-in happens inside the provider's own surface (the pinned upstream carries no CLI sign-in to run). Sign in there yourself, then press Refresh.`,
        );
      if (facts.canSignInWithoutTerminal) {
        // No window: the tool opens the browser itself and ends once the browser's answer reaches its local port.
        const run = yield* runShortCommand(commands[harness], signIn.args, signIn.env, signInTimeoutMillis);
        if (run.code !== 0) {
          const reason = run.output.trim().split("\n").slice(-3).join(" ");
          return yield* invalid(
            `${facts.label} did not sign in${run.code === null ? ` (it timed out after ${signInTimeoutMillis / 60_000} minutes or could not run)` : ""}. ${reason}`.trim(),
          );
        }
        return { _tag: "Finished" as const };
      }
      // Run inside Outlore's host-side PTY terminal instead of spawning an external terminal window.
      const command = [quoted(commands[harness]), ...signIn.args.map(shellWord)].join(" ");
      const env =
        signIn.shouldKeepPath && process.env.PATH !== undefined
          ? { ...signIn.env, PATH: process.env.PATH }
          : signIn.env;
      return { _tag: "Terminal" as const, command, env, label: facts.label };
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

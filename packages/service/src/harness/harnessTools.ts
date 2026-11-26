import type { EffortChoice, HarnessName, ModelOption, SignInState } from "@outlore/contracts";
import { Context, Effect, Layer } from "effect";
import type { ServiceFailure } from "../core/index.ts";
import { harnessFacts } from "./harnessCatalog.ts";

// What Outlore asks each harness's own command-line tool about itself: its version, who is signed in, and its models; and how the owner signs in, always through the tool's own sign-in (requirements, Comply with provider terms).
// Outlore never reads or stores the credentials.

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

/** How a harness's own sign-in ran: finished in the background, or ready to run in Outlore's inline terminal. */
export type SignInLaunch =
  | { readonly _tag: "Finished" }
  | {
      readonly _tag: "Terminal";
      readonly command: string;
      readonly env: Readonly<Record<string, string>>;
      readonly label: string;
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
    /** The effort levels the provider offers for one model, lowest first, without "default"; fails when the provider could not be asked. */
    readonly listEfforts: (
      harness: HarnessName,
      configDirectory: string | null,
      model: string,
    ) => Effect.Effect<ReadonlyArray<EffortChoice>, ServiceFailure>;
    /** Runs the harness's own sign-in pointed at the account's folder, either in the background ("Finished") or in Outlore's inline terminal ("Terminal"). */
    readonly openSignIn: (
      harness: HarnessName,
      configDirectory: string | null,
    ) => Effect.Effect<SignInLaunch, ServiceFailure>;
    readonly readSignIn: (harness: HarnessName, configDirectory: string | null) => Effect.Effect<SignInStatus>;
    /** Runs the harness's own update command, which updates it the way it was installed. */
    readonly update: (harness: HarnessName) => Effect.Effect<void, ServiceFailure>;
  }
>()("outlore/HarnessTools") {}

/** The executable each harness runs as. */
export type HarnessCommands = Record<HarnessName, string>;

/** How long a sign-in that needs no terminal may wait for the owner in the browser before it is ended. */
export const signInTimeoutMillis = 5 * 60 * 1000;

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
        return harnessFacts[harness].canSignInWithoutTerminal
          ? ({ _tag: "Finished" } as const)
          : ({ _tag: "Terminal", command: "true", env: {}, label: harnessFacts[harness].label } as const);
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

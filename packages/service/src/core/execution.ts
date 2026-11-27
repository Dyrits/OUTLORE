import { readFile } from "node:fs/promises";
import type { ApprovalLevel, HarnessName, TokenUsage } from "@outlore/contracts";
import { Context, Effect } from "effect";
import {
  type BackgroundWakeListener,
  type Containment,
  HarnessFailure,
  type ImageAttachment,
  type PlanLimitsReport,
  runKeyOf,
  type SteeredMessage,
  type TurnOutcome,
  type TurnRequest,
} from "./executionTypes.ts";
import type { VaultDenial } from "./vaultFolder.ts";

/** How long a harness has to end an interrupted turn before its process is closed (CHG-0039, provisional). */
export const interruptGraceMillis = 10_000;

/** The outcome of an interrupted turn: its usage when the harness reported any, and never a cost. */
export const interruptedOutcomeOf = (sessionId: string, usage: TokenUsage | null = null): TurnOutcome => ({
  billing: "Unknown",
  cost: null,
  isInterrupted: true,
  sessionId,
  usage,
});

/**
 * What one harness adapter offers: one turn per run at a time, which can be steered and interrupted. A run is named by
 * its key (`TurnRequest.runKey`); a thread's main run is keyed by the thread's id, so asking by thread id reaches it.
 */
export interface HarnessAdapter {
  /** Whether the harness runs its tools inside an enforced sandbox here at the approval level. */
  readonly containmentOf?: (harness: HarnessName, level: ApprovalLevel) => Containment;
  /** Ends the run's running turn, whose `runTurn` then returns as interrupted; false when none runs. */
  readonly interrupt: (runKey: string) => Effect.Effect<boolean>;
  /** Registers who is asked when a harness process wakes itself between turns (Claude Code, when a background command ends). */
  readonly onBackgroundWake?: (listener: BackgroundWakeListener) => void;
  /** Asks the harness's own tool for the limits of the plan behind an account (null: the computer's own sign-in). */
  readonly readPlanLimits: (
    harness: HarnessName,
    configDirectory: string | null,
  ) => Effect.Effect<PlanLimitsReport | null, HarnessFailure>;
  /** Tries to read a marker file in the Vault's folder from inside this harness's sandbox, with an outside control, and reports whether the sandbox hides it (ADR 0022). */
  readonly readVaultDenial?: (harness: HarnessName, folder: string) => Effect.Effect<VaultDenial>;
  readonly runTurn: (request: TurnRequest) => Effect.Effect<TurnOutcome, HarnessFailure>;
  /** Runs the live probe of the Vault's folder denial, the one only a live model turn can verify (Claude Code), and keeps its result as the stamp readVaultDenial then reads (ADR 0022). */
  readonly runVaultDenialLive?: (harness: HarnessName, folder: string) => Effect.Effect<VaultDenial>;
  /** Writes a message into the run's running turn; false when no turn runs or the harness cannot take one mid-turn. */
  readonly steer: (runKey: string, message: SteeredMessage) => Effect.Effect<boolean>;
}

/** The harness seam: runs one turn of a thread, reports its events, and lets it be steered and interrupted. */
export class Harness extends Context.Service<Harness, HarnessAdapter>()("outlore/Harness") {}

/** Sends each turn to the adapter of its thread's harness, and steering and interrupts to the adapter running that run's turn (provider-accounts). */
export const routeHarnesses = (adapters: Record<HarnessName, HarnessAdapter>): HarnessAdapter => {
  // By run key, so a run beside a thread's main turn neither replaces nor clears the main turn's route.
  const running = new Map<string, HarnessAdapter>();
  return {
    containmentOf: (harness, level) => adapters[harness].containmentOf?.(harness, level) ?? "Unprotected",
    interrupt: (runKey) => running.get(runKey)?.interrupt(runKey) ?? Effect.succeed(false),
    onBackgroundWake: (listener) => {
      for (const adapter of Object.values(adapters)) adapter.onBackgroundWake?.(listener);
    },
    readPlanLimits: (harness, configDirectory) => adapters[harness].readPlanLimits(harness, configDirectory),
    readVaultDenial: (harness, folder) =>
      adapters[harness].readVaultDenial?.(harness, folder) ??
      Effect.succeed({ harness, reason: "It runs no enforced sandbox, so every action asks.", status: "AsksFirst" }),
    runTurn: (request) =>
      Effect.suspend(() => {
        const adapter = adapters[request.harness];
        running.set(runKeyOf(request), adapter);
        return adapter.runTurn(request);
      }).pipe(Effect.ensuring(Effect.sync(() => running.delete(runKeyOf(request))))),
    runVaultDenialLive: (harness, folder) =>
      adapters[harness].runVaultDenialLive?.(harness, folder) ??
      Effect.succeed({
        harness,
        reason: "This harness has no live probe of the Vault's folder.",
        status: "Unverified",
      }),
    steer: (runKey, message) => running.get(runKey)?.steer(runKey, message) ?? Effect.succeed(false),
  };
};

/** The images' bytes, base64, for a harness that takes them inline; a file that cannot be read fails the turn with the reason. */
export const readImages = (images: ReadonlyArray<ImageAttachment>) =>
  Effect.tryPromise({
    catch: (error) => new HarnessFailure({ reason: `Could not read an attached image: ${String(error)}` }),
    try: () =>
      Promise.all(
        images.map(async (image) => ({
          data: (await readFile(image.path)).toString("base64"),
          mediaType: image.mediaType,
        })),
      ),
  });

/** The turn's message as the harness receives it: the note (journal, lore, budget) first, set off from the messages. */
export const turnMessageOf = (request: TurnRequest) =>
  request.note === null ? request.text : `${request.note}\n\n---\n\n${request.text}`;

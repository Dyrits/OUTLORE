import type { BillingKind, HarnessName } from "@outlore/contracts";
import { Effect } from "effect";
import {
  type Containment,
  fieldOf,
  HarnessFailure,
  reducedEnvironmentOf,
  type SteeredMessage,
  startRpcProcess,
  type TurnRequest,
  textFieldOf,
  turnMessageOf,
} from "../core/index.ts";
import {
  billingOf,
  type CodexConnection,
  type CodexOptions,
  effortOf,
  inputOf,
  profileOf,
  readCodexPlanLimits,
  threadSettingsOf,
} from "./codexProtocol.ts";
import { readCodexTurn } from "./codexTurn.ts";
import { vaultProfileArgsOf, vaultProfileName } from "./codexVaultProfile.ts";
import { accountEnvironmentOf } from "./harnessCatalog.ts";
import { type HarnessProtocol, makeHarnessProcesses, type PooledTurn } from "./harnessProcesses.ts";
import { resolvedFolderOf, resolveStartFolder } from "./threadFolder.ts";
import { readCodexVaultDenial } from "./vaultDenials.ts";

// Codex through its app server (ADR 0008; protocol of codex-cli 0.160.1, probed 2026-11-07): one `codex app-server` process per thread, one Codex thread per Outlore thread.

export type { CodexOptions } from "./codexProtocol.ts";

/** Asks Codex to end its turn; the turn's own completion, as interrupted, ends it, so the answer is not awaited. */
const askToInterrupt = (connection: CodexConnection, turnId: string) =>
  Effect.forkDetach(
    connection.rpc.request("turn/interrupt", { threadId: connection.sessionId, turnId }).pipe(Effect.ignore),
  );

/** Codex's app-server protocol: one Codex thread per Outlore thread, one Codex turn per turn. */
const codexProtocolOf = (options: CodexOptions): HarnessProtocol<CodexConnection> => ({
  interrupt: Effect.fnUntraced(function* (connection: CodexConnection) {
    // Before Codex answers `turn/start` there is no turn id to name: the turn, which the pool already counts as interrupting, asks for the interrupt as soon as it has the id.
    if (connection.turnId !== null) yield* askToInterrupt(connection, connection.turnId);
    return true;
  }),

  // A changed level, set of permissions, context, model, folder, or account restarts the process, resuming its thread; the effort goes with each turn.
  // Where the folder really points too: a link pointed elsewhere restarts the process, whose start checks it again.
  restartKeyOf: (request) => {
    const profile = profileOf(request.cwd, options.vaultFolder ?? null);
    return JSON.stringify([
      threadSettingsOf(request, request.cwd, profile),
      // Worktrees and submodules can change the grants without changing the type of profile.
      profile?.grants ?? {},
      // The tools are listed when the process starts, so a change of Code Mode restarts it.
      request.access.usesCodeMode,
      request.access.connectorTools,
      request.configDirectory,
      resolvedFolderOf(request.cwd),
    ]);
  },

  runTurn: Effect.fnUntraced(function* (connection: CodexConnection, request: TurnRequest, turn: PooledTurn) {
    const effort = effortOf(request.effort);
    connection.turnId = null;
    const started = yield* connection.rpc.request("turn/start", {
      input: inputOf(turnMessageOf(request), request.images),
      threadId: connection.sessionId,
      ...(effort === null ? {} : { effort }),
      ...(request.model === "default" ? {} : { model: request.model }),
    });
    const codexTurnId = textFieldOf(fieldOf(started, "turn"), "id") ?? "";
    connection.turnId = codexTurnId;
    if (turn.isInterrupting()) yield* askToInterrupt(connection, codexTurnId);
    return yield* readCodexTurn(connection, request, turn, codexTurnId).pipe(
      Effect.ensuring(Effect.sync(() => (connection.turnId = null))),
    );
  }),

  start: Effect.fnUntraced(function* (request: TurnRequest) {
    // A thread folder that is a link asks the owner; allowed, Codex starts where it really points, as its process folder and its thread's, so its workspace sandbox writes there (threadFolder.ts).
    // Codex 0.167.2 refuses a writable root holding a link, and treats its process folder, resolved by the system, as writable (CHG-0208).
    const cwd = yield* resolveStartFolder(request, "Codex");
    // The named profile is defined on the process, not in `thread/start`'s `config`: a turn reloads the settings without that thread's overrides, finds no such profile, and fails with "failed to load workspace requirements: invalid input parameter" (Codex 0.170.0, 2026-11-20).
    // A profile in the process settings also needs `default_permissions`.
    // Folder approval may have waited on the owner, so read the grants fresh at the actual start.
    const profile = yield* Effect.sync(() => profileOf(cwd, options.vaultFolder ?? null));
    const profileArgs =
      profile === null
        ? []
        : [
            "-c",
            `default_permissions=${JSON.stringify(vaultProfileName)}`,
            ...vaultProfileArgsOf(profile.vaultFolder, profile.grants),
          ];
    const rpc = yield* startRpcProcess({
      args: [...(options.prefixArgs ?? []), "app-server", ...profileArgs],
      command: options.command,
      cwd,
      env: reducedEnvironmentOf({ ...accountEnvironmentOf("codex", request.configDirectory), PWD: cwd }),
      isJsonRpc2: false,
      label: "Codex",
    });
    let billing: BillingKind = "Unknown";
    const started = yield* Effect.gen(function* () {
      yield* rpc.request("initialize", {
        capabilities: { experimentalApi: true, requestAttestation: false },
        clientInfo: { name: "outlore", title: "Outlore", version: "0.0.0" },
      });
      rpc.notify("initialized", {});
      const settings = threadSettingsOf(request, cwd, profile);
      billing = yield* billingOf(rpc);
      return request.sessionId === null
        ? yield* rpc.request("thread/start", settings)
        : yield* rpc.request("thread/resume", { ...settings, threadId: request.sessionId });
    }).pipe(Effect.tapError(() => Effect.sync(() => rpc.close())));
    const codexThreadId = textFieldOf(fieldOf(started, "thread"), "id");
    if (codexThreadId === null) {
      rpc.close();
      return yield* new HarnessFailure({ reason: "Codex started no thread." });
    }
    return {
      billing,
      close: rpc.close,
      hasExited: rpc.hasExited,
      rpc,
      sessionId: codexThreadId,
      turnId: null,
    } satisfies CodexConnection;
  }),

  // A message steered mid-turn joins Codex's active turn; its userMessage item, carrying our id as clientId, says it was taken in.
  steer: Effect.fnUntraced(function* (connection: CodexConnection, message: SteeredMessage) {
    if (connection.turnId === null) return false;
    return yield* connection.rpc
      .request("turn/steer", {
        clientUserMessageId: message.id,
        expectedTurnId: connection.turnId,
        input: inputOf(message.text, message.images),
        threadId: connection.sessionId,
      })
      .pipe(
        Effect.as(true),
        Effect.catch(() => Effect.succeed(false)),
      );
  }),
});

/** Runs each thread in one long-lived `codex app-server` process, closed with the scope that made it. */
export const makeCodexHarness = (options: CodexOptions) =>
  makeHarnessProcesses(codexProtocolOf(options), options).pipe(
    Effect.map((adapter) => ({
      ...adapter,
      // Codex enforces its own workspace sandbox wherever it runs.
      containmentOf: (): Containment => "Sandboxed",
      readPlanLimits: (_harness: HarnessName, configDirectory: string | null) =>
        readCodexPlanLimits(options, configDirectory),
      readVaultDenial: (harness: HarnessName, folder: string) => readCodexVaultDenial(options, harness, folder),
    })),
  );

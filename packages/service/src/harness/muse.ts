import { MuseClient, type Session } from "@muse-code/sdk";
import type { Duration, Scope } from "effect";
import { Effect } from "effect";
import {
  type Containment,
  type HarnessAdapter,
  numberFieldOf,
  readImages,
  reducedEnvironmentOf,
  type SteeredMessage,
  type TurnRequest,
} from "../core/index.ts";
import { type HarnessProtocol, makeHarnessProcesses } from "./harnessProcesses.ts";
import { museModelSelectionOf } from "./museAccount.ts";
import { museReasoningEffortOf } from "./museProtocol.ts";
import { inputPartsOf, type MuseConnection, museFailureOf, runMuseTurn } from "./museTurn.ts";
import { resolvedFolderOf } from "./threadFolder.ts";
import { toolServerName } from "./toolNames.ts";

// Muse through `muse serve` over the Muse Session Protocol, driven by @muse-code/sdk (ADR 0008: the native protocol first).
// One host process per thread, one root session per Outlore thread, one `turn/start` per turn.
// Outlore's own tools reach the session as a `sessionMcp` server, the session starts asking before acting (approval mode `promptUnmatched`), and every approval it sends is answered by asking the owner.
// A request whose offered choices cannot express the answer as asked is never satisfied: the turn stops and names the reason (fail closed — ADR 0007).

/** How a Muse harness starts. */
export type MuseOptions = {
  /** The executable; `muse` on the PATH by default. */
  readonly command: string;
  /** Extra environment for the whole process, such as a stand-in's knobs in checks. */
  readonly env?: Record<string, string>;
  /** How long an idle thread keeps its host. */
  readonly idleTimeout: Duration.Input;
  /** Arguments placed before Muse's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
  /** Raw host stderr, drained from birth and never parsed. */
  readonly onStderr?: (chunk: string) => void;
};

/** The client identity the service presents to the host. */
const clientInfo = { name: "outlore", title: "Outlore", version: "0.0.0" };

/** The session's MCP servers: Outlore's own tool server, as a streamable HTTP endpoint (ADR 0005). */
const mcpServersOf = (request: TurnRequest) => ({
  [toolServerName]: { transport: "streamableHttp" as const, url: request.access.mcpUrl },
});

/** The line a thread shows when Muse could not pick up the thread's earlier session. */
const lostSessionNote =
  "Muse could not pick up this thread's earlier conversation from its own store. The thread carries on in a " +
  "new Muse session, given the thread's conversation so far, as when a thread changes harness.";

/** Opens the thread's session on the host: the one Muse kept, or a new one it hands the thread's history to. */
const openMuseSession = Effect.fnUntraced(function* (client: MuseClient, request: TurnRequest) {
  const config = {
    developerPrompt: request.context,
    mcpServers: mcpServersOf(request),
  };
  const selection = museModelSelectionOf(request.model);
  const start = () =>
    Effect.tryPromise({
      catch: (error) => museFailureOf(error, "start a session"),
      try: () =>
        client.startSession({
          approvalMode: "promptUnmatched",
          config,
          workspaceRoot: request.cwd,
          ...(selection === null ? {} : { modelId: selection.modelId, providerId: selection.providerId }),
        }),
    });
  const kept =
    request.sessionId === null
      ? null
      : yield* Effect.tryPromise({
          catch: (error) => museFailureOf(error, "resume the session"),
          try: () =>
            client.resumeSession({
              config,
              sessionId: request.sessionId ?? "",
              ...(selection === null ? {} : { modelId: selection.modelId }),
            }),
        }).pipe(
          Effect.map((session) => ({ isEvicted: false as const, session })),
          // A session the host no longer holds is replaced, visibly, rather than losing the thread's history.
          Effect.catch(() => Effect.succeed({ isEvicted: true as const, session: null })),
        );
  let session: Session<unknown>;
  let handoverNotes: string | null = null;
  if (kept === null) {
    session = yield* start();
  } else if (kept.isEvicted) {
    yield* request.onEvent({ _tag: "Notice", text: lostSessionNote });
    handoverNotes = yield* request.conversationSoFar;
    session = yield* start();
  } else {
    session = kept.session;
  }
  const effort = museReasoningEffortOf(request.effort);
  if (effort !== null)
    yield* Effect.tryPromise({
      catch: (error) => museFailureOf(error, `set the reasoning effort ${effort}`),
      try: () => session.setReasoningEffort(effort),
    });
  return { handoverNotes, session };
});

/** Muse's own protocol, as one kept host per thread. */
const museProtocolOf = (options: MuseOptions): HarnessProtocol<MuseConnection> => ({
  interrupt: (connection) =>
    Effect.suspend(() => {
      const running = connection.running;
      if (running === null) return Effect.succeed(false);
      return Effect.promise(() =>
        running
          .interrupt()
          .then(() => true)
          .catch(() => false),
      );
    }),

  // A changed context, access, account, model, or folder restarts the host, loading its session.
  restartKeyOf: (request) =>
    JSON.stringify([
      request.context,
      request.access,
      request.configDirectory,
      request.model,
      request.effort,
      resolvedFolderOf(request.cwd),
    ]),

  runTurn: runMuseTurn,

  start: Effect.fnUntraced(function* (request: TurnRequest) {
    const client = yield* Effect.tryPromise({
      catch: (error) => museFailureOf(error, "start its host"),
      try: () =>
        MuseClient.spawn({
          args: [...(options.prefixArgs ?? []), "serve"],
          clientInfo,
          cwd: request.cwd,
          env: reducedEnvironmentOf(options.env ?? {}),
          museBin: options.command,
          ...(options.onStderr === undefined ? {} : { onStderr: options.onStderr }),
        }),
    });
    const exited = { isDone: false };
    void client.exit.then(
      () => {
        exited.isDone = true;
      },
      () => {
        exited.isDone = true;
      },
    );
    // Listeners start before the session opens, so nothing the host says while it opens is lost.
    const complaints: Array<string> = [];
    const context: MuseConnection["context"] = { used: null, window: null };
    client.onProtocolError((error) => {
      complaints.push(error.message);
    });
    client.onNotification((frame) => {
      if (frame.method !== "session/contextUsage") return;
      const window = numberFieldOf(frame.params, "windowTokens");
      context.used = numberFieldOf(frame.params, "usedTokens");
      context.window = window === 0 ? null : window;
    });
    const closeClient = () => {
      void client.close().catch(() => void 0);
    };
    const opened = yield* openMuseSession(client, request).pipe(Effect.tapError(() => Effect.sync(closeClient)));
    const connection: MuseConnection = {
      client,
      close: closeClient,
      complaints,
      context,
      exited: false,
      handoverNotes: opened.handoverNotes,
      hasExited: () => exited.isDone,
      mediationProblem: null,
      running: null,
      session: opened.session,
      sessionId: opened.session.sessionId,
      steered: new Map(),
    };
    return connection;
  }),

  /** Writes into the running turn (SS3.3): taken in when its folded user message names the steer's command. */
  steer: Effect.fnUntraced(function* (connection: MuseConnection, message: SteeredMessage) {
    const running = connection.running;
    if (running === null) return false;
    // An unreadable image leaves the message for the next turn, as a steer the turn could not take does.
    const images = yield* readImages(message.images).pipe(Effect.catch(() => Effect.succeed([])));
    const steered = yield* Effect.promise(() =>
      running.steer({ input: inputPartsOf(message.text, images) }).catch(() => null),
    );
    if (steered === null) return false;
    connection.steered.set(steered.commandId, message.id);
    return true;
  }),
});

/** Runs each thread on one kept `muse serve` host, its turns mediated through the owner's approvals and reporting Unprotected containment. */
export const makeMuseHarness = (options: MuseOptions): Effect.Effect<HarnessAdapter, never, Scope.Scope> =>
  Effect.map(
    makeHarnessProcesses(museProtocolOf(options), options),
    (adapter) =>
      ({
        ...adapter,
        containmentOf: (): Containment => "Unprotected",
      }) satisfies HarnessAdapter,
  );

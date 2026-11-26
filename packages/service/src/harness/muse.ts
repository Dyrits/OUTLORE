import { type ApprovalDecisionInput, MuseClient, type Session, type Turn } from "@muse-code/sdk";
// The generated wire types are not on the SDK's public barrel; the parameters of an approval request and
// the session config are consumer surface, reached here through the published dist path.
import type { ApprovalRequestParams } from "@muse-code/sdk/dist/src/msp.js";
import type { Duration, Scope } from "effect";
import { Effect, Stream } from "effect";
import {
  type Containment,
  type HarnessAdapter,
  type HarnessEvent,
  HarnessFailure,
  numberFieldOf,
  readImages,
  reducedEnvironmentOf,
  type SteeredMessage,
  type TurnRequest,
  textFieldOf,
  turnMessageOf,
} from "../core/index.ts";
import {
  type HarnessConnection,
  type HarnessProtocol,
  makeHarnessProcesses,
  type PooledTurn,
} from "./harnessProcesses.ts";
import { museModelSelectionOf } from "./museAccount.ts";
import {
  type MuseApproval,
  museApprovalChoice,
  museInputOf,
  musePromptOf,
  museReasoningEffortOf,
  museUsageOf,
} from "./museProtocol.ts";
import { resolvedFolderOf } from "./threadFolder.ts";
import { toolServerName } from "./toolNames.ts";

// Muse through `muse serve` over the Muse Session Protocol, driven by @muse-code/sdk (ADR 0008: the native
// protocol first). One host process per thread, one root session per Outlore thread, one `turn/start` per
// turn. Outlore's own tools reach the session as a `sessionMcp` server, the session starts asking before
// acting (approval mode `promptUnmatched` — a client selects a mode the host defines, never invents one),
// and every approval it sends is answered by asking the owner. A request whose offered choices cannot
// express the answer as asked is never satisfied: the turn stops and names the reason (fail closed, so an
// unverified privilege boundary stays enforced — ADR 0007).

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

/** The turn's input parts: the message, then each image as its own part. */
const inputPartsOf = (text: string, images: ReadonlyArray<{ readonly data: string; readonly mediaType: string }>) => [
  { text, type: "text" as const },
  ...images.map((image) => ({ base64Data: image.data, mediaType: image.mediaType, type: "image" as const })),
];

/** How a muse host start or answer failure reads to the owner. */
const museFailureOf = (error: unknown, doing: string): HarnessFailure =>
  new HarnessFailure({
    reason: `Muse could not ${doing}: ${error instanceof Error ? error.message : String(error)}`,
  });

/** A thread's kept Muse host, its session, and what its running turns need. */
interface MuseConnection extends HarnessConnection {
  readonly client: MuseClient;
  /** Protocol violations and listener failures the host caused, drained as a Notice on the next turn. */
  readonly complaints: Array<string>;
  /** The session's context gauge, as its context usage report last said. */
  context: { used: number | null; window: number | null };
  /** Whether the host process has ended. */
  exited: boolean;
  /** The thread's conversation so far, given to the session that replaced one Muse could not load; null once given. */
  handoverNotes: string | null;
  /** Why the running turn ends as failed, set when an approval could not be mediated or the host broke; null when it runs ask-free. */
  mediationProblem: string | null;
  /** The running turn, for the pool's interrupt and this adapter's steers; null between turns. */
  running: Turn<unknown> | null;
  session: Session<unknown>;
  /** The session the thread's turns run on, as the host named it. */
  sessionId: string;
  /** Steered submissions by their command id, waiting for the folded echo that delivers their message. */
  readonly steered: Map<string, string>;
}

/** One approval request, as the adapter reads it off the wire. */
const museApprovalOf = (asked: ApprovalRequestParams): MuseApproval => ({
  approvalId: asked.approvalId,
  availableChoices: asked.availableChoices.map((choice) => ({
    acceptsFeedback: choice.acceptsFeedback === true,
    choiceId: choice.choiceId,
    decision: choice.decision,
    scope: choice.scope,
  })),
  rawArgs: asked.rawArgs,
  toolName: asked.toolName,
});

/** Ends the running turn, leaving the reason for `runTurn` to fail with. */
const stopFailedTurn = (connection: MuseConnection, reason: string) => {
  connection.mediationProblem ??= reason;
  void connection.running?.interrupt().catch(() => void 0);
};

/**
 * Answers the session's approvals with the owner's decision, through the fail-closed seam: only the
 * offered once-scoped approval grants, and only an offered deny or abort refuses. A request whose choices
 * cannot express the answer as asked is never satisfied — the turn is stopped and named by its reason
 * instead (ADR 0007: an unenforceable privilege is not granted).
 */
const museApproverOf =
  (connection: MuseConnection, request: Pick<TurnRequest, "askOwner">) =>
  async (asked: ApprovalRequestParams): Promise<ApprovalDecisionInput> => {
    const approval = museApprovalOf(asked);
    const answer = await Effect.runPromise(request.askOwner(musePromptOf(approval)));
    const choiceId = museApprovalChoice(approval.availableChoices, answer.isAllowed);
    if (choiceId === null) {
      stopFailedTurn(
        connection,
        `${approval.toolName}: Muse offered no once-scoped approval${answer.isAllowed ? "" : ", nor any deny"}, so the turn stopped rather than guess.`,
      );
      // The SDK takes a rejected promise as an approval it could not answer; the turn already carries the reason.
      return Promise.reject(new Error("Muse approval not mediated"));
    }
    const chosen = approval.availableChoices.find((candidate) => candidate.choiceId === choiceId);
    const feedback = answer.text.trim() === "" || chosen?.acceptsFeedback !== true ? {} : { feedback: answer.text };
    return { choiceId, ...feedback };
  };

/** What a failed approval round trip the turn already failed for is worth: a line, never a second stop. */
const museApprovalFailureKinds = ["submitFailed", "unofferedChoice", "feedbackNotAccepted"] as const;

/** Maps one folded transcript item to the events the thread saves; replies only complete, non-commentary answers. */
const museItemEventOf =
  (connection: MuseConnection) =>
  (item: unknown): HarnessEvent | null => {
    const kind = textFieldOf(item, "kind");
    const status = textFieldOf(item, "status");
    if (kind === "userMessage") {
      const message = connection.steered.get(textFieldOf(item, "commandId") ?? "");
      return message === undefined ? null : { _tag: "Delivered", messageId: message };
    }
    if (kind === "agentMessage") {
      const text = textFieldOf(item, "text") ?? "";
      if (status === "inProgress") return text === "" ? null : { _tag: "Draft", text };
      return text.trim() === "" || textFieldOf(item, "messagePhase") === "commentary"
        ? null
        : { _tag: "Reply", model: textFieldOf(item, "modelId"), text };
    }
    if (kind === "toolCall" && status === "inProgress") {
      const itemId = textFieldOf(item, "itemId");
      if (itemId === null) return null;
      return {
        _tag: "ToolCall",
        id: itemId,
        input: museInputOf(textFieldOf(item, "args") ?? ""),
        toolName: textFieldOf(item, "tool") ?? "tool",
      };
    }
    return null;
  };

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
          Effect.map((session) => ({ evicted: false as const, session })),
          // A session the host no longer holds is replaced, visibly, rather than losing the thread's history.
          Effect.catch(() => Effect.succeed({ evicted: true as const, session: null })),
        );
  let session: Session<unknown>;
  let handoverNotes: string | null = null;
  if (kept === null) {
    session = yield* start();
  } else if (kept.evicted) {
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

  runTurn: Effect.fnUntraced(function* (connection: MuseConnection, request: TurnRequest, turn: PooledTurn) {
    connection.mediationProblem = null;
    connection.session.onApproval(museApproverOf(connection, request));
    connection.session.onApprovalError((failure) => {
      if (museApprovalFailureKinds.includes(failure.kind as (typeof museApprovalFailureKinds)[number]))
        stopFailedTurn(connection, `an approval round trip failed: ${failure.kind}`);
    });
    const complaint = connection.complaints.splice(0).join(" ");
    if (complaint !== "")
      yield* request.onEvent({
        _tag: "Notice",
        text: `Muse's host misbehaved; the turn carries on: ${complaint}.`,
      });
    const notes = connection.handoverNotes;
    connection.handoverNotes = null;
    const text = notes === null ? turnMessageOf(request) : `${notes}\n\n${turnMessageOf(request)}`;
    const images = yield* readImages(request.images);
    const reasoning = museReasoningEffortOf(request.effort);
    const handle = yield* Effect.tryPromise({
      catch: (error) => museFailureOf(error, "take the turn"),
      try: () =>
        connection.session.sendUserTurn({
          input: inputPartsOf(text, images),
          ...(reasoning === null ? {} : { reasoningEffort: reasoning }),
        }),
    });
    connection.running = handle;
    const eventOf = museItemEventOf(connection);
    const items = Stream.fromAsyncIterable(handle.items(), (error) => museFailureOf(error, "read the turn"));
    // Muse streams an item's revisions, and a terminal that re-emits the last revision re-yields nothing
    // (INV-003), so the turn's final answers are read from the fold below, deduplicated against the draft
    // stream's own replies by the item that wrote them.
    const reported = new Set<string>();
    const drainComplaints = Effect.suspend(() => {
      const complaint = connection.complaints.splice(0).join(" ");
      return complaint === ""
        ? Effect.void
        : request.onEvent({ _tag: "Notice", text: `Muse's host misbehaved; the turn carries on: ${complaint}.` });
    });
    yield* items.pipe(
      Stream.mapEffect((item) => {
        const event = eventOf(item);
        const itemId = textFieldOf(item, "itemId");
        if (event === null || itemId === null) return Effect.void;
        if (event._tag === "Reply" || event._tag === "ToolCall") reported.add(itemId);
        return event._tag === "Delivered" ? turn.deliver(event.messageId) : request.onEvent(event);
      }),
      Stream.tap(() => drainComplaints),
      Stream.runDrain,
    );
    yield* drainComplaints;
    const outcome = yield* Effect.promise(() => handle.completed);
    for (const item of connection.session.fold.items.list()) {
      const event = eventOf(item);
      const itemId = textFieldOf(item, "itemId");
      if (event?._tag !== "Reply" || (itemId !== null && reported.has(itemId))) continue;
      if (itemId !== null) reported.add(itemId);
      yield* request.onEvent(event);
    }
    connection.running = null;
    if (connection.mediationProblem !== null) return yield* new HarnessFailure({ reason: connection.mediationProblem });
    if (outcome.kind === "unqueued") return { isInterrupted: true, usage: null };
    if (outcome.kind !== "completed")
      return yield* new HarnessFailure({ reason: "Muse's session ended the turn without a terminal." });
    const failure = outcome.params.error;
    if (outcome.params.terminal === "failed")
      return yield* new HarnessFailure({
        reason: `Muse's turn failed: ${textFieldOf(failure ?? {}, "message") ?? "the host named no reason."}`,
      });
    return {
      context: connection.context.used,
      contextWindow: connection.context.window,
      isInterrupted: outcome.params.terminal === "cancelled" || turn.isInterrupting(),
      usage: museUsageOf(outcome.params.usage),
    };
  }),

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
    const exited = { done: false };
    void client.exit.then(
      () => {
        exited.done = true;
      },
      () => {
        exited.done = true;
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
      hasExited: () => exited.done,
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

/**
 * Runs each thread on one kept `muse serve` host, its turns mediated through the owner's approvals, its
 * processes closed with the scope that made it. Muse reads no sandbox Outlore enforces here, so its
 * adapter reports Unprotected: every action its host asks about asks the owner.
 */
export const makeMuseHarness = (options: MuseOptions): Effect.Effect<HarnessAdapter, never, Scope.Scope> =>
  Effect.map(
    makeHarnessProcesses(museProtocolOf(options), options),
    (adapter) =>
      ({
        ...adapter,
        containmentOf: (): Containment => "Unprotected",
      }) satisfies HarnessAdapter,
  );

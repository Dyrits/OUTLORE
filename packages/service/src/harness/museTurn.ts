import type { ApprovalDecisionInput, MuseClient, Session, Turn } from "@muse-code/sdk";
// The generated wire types are not on the SDK's public barrel; the parameters of an approval request are consumer surface, reached here through the published dist path.
import type { ApprovalRequestParams } from "@muse-code/sdk/dist/src/msp.js";
import { Effect, Stream } from "effect";
import {
  type HarnessEvent,
  HarnessFailure,
  readImages,
  type TurnRequest,
  textFieldOf,
  turnMessageOf,
} from "../core/index.ts";
import type { HarnessConnection, PooledTurn } from "./harnessProcesses.ts";
import {
  type MuseApproval,
  museApprovalChoice,
  museInputOf,
  musePromptOf,
  museReasoningEffortOf,
  museUsageOf,
} from "./museProtocol.ts";

/** The turn's input parts: the message, then each image as its own part. */
export const inputPartsOf = (
  text: string,
  images: ReadonlyArray<{ readonly data: string; readonly mediaType: string }>,
) => [
  { text, type: "text" as const },
  ...images.map((image) => ({ base64Data: image.data, mediaType: image.mediaType, type: "image" as const })),
];

/** How a muse host start or answer failure reads to the owner. */
export const museFailureOf = (error: unknown, doing: string): HarnessFailure =>
  new HarnessFailure({
    reason: `Muse could not ${doing}: ${error instanceof Error ? error.message : String(error)}`,
  });

/** A thread's kept Muse host, its session, and what its running turns need. */
export interface MuseConnection extends HarnessConnection {
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

/** Answers the session's approvals with the owner's decision through the fail-closed seam (ADR 0007). */
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
const museApprovalFailureKinds: ReadonlySet<string> = new Set([
  "submitFailed",
  "unofferedChoice",
  "feedbackNotAccepted",
]);

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

/** Runs one turn on a kept Muse session, mediating approvals and draining transcript items until completion. */
export const runMuseTurn = Effect.fnUntraced(function* (
  connection: MuseConnection,
  request: TurnRequest,
  turn: PooledTurn,
) {
  connection.mediationProblem = null;
  connection.session.onApproval(museApproverOf(connection, request));
  connection.session.onApprovalError((failure) => {
    if (museApprovalFailureKinds.has(failure.kind))
      stopFailedTurn(connection, `an approval round trip failed: ${failure.kind}`);
  });
  const drainComplaints = Effect.suspend(() => {
    const complaint = connection.complaints.splice(0).join(" ");
    return complaint === ""
      ? Effect.void
      : request.onEvent({ _tag: "Notice", text: `Muse's host misbehaved; the turn carries on: ${complaint}.` });
  });
  yield* drainComplaints;
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
  // Muse streams an item's revisions, and a terminal that re-emits the last revision re-yields nothing (INV-003), so the turn's final answers are read from the fold below, deduplicated against the draft stream's own replies by the item that wrote them.
  const reported = new Set<string>();
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
});

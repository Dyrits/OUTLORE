import type { BillingKind, TokenUsage } from "@outlore/contracts";
import { Effect, Queue } from "effect";
import {
  fieldOf,
  HarnessFailure,
  type ImageAttachment,
  type PlanLimitsReport,
  readImages,
  type StreamJsonProcess,
  type TurnRequest,
  textFieldOf,
  turnMessageOf,
} from "../core/index.ts";
import { networkHostOf } from "./claudeArgs.ts";
import {
  backgroundTaskNoticeOf,
  billingOf,
  compactionNoticeOf,
  failureReasonOf,
  reportedModelOf,
  reportedWindowOf,
  textOf,
  toolCallsOf,
  toolServerFailureOf,
  usageOf,
} from "./claudeEvents.ts";
import { planLimitsOf } from "./claudePlanLimits.ts";
import { claudeToolCallOf } from "./claudeToolCalls.ts";
import type { HarnessConnection, PooledTurn } from "./harnessProcesses.ts";
import { addUsage, contextOf } from "./tokenUsage.ts";
import { toolServerName } from "./toolNames.ts";

// Claude Code stream-json turn loop and message content encoding (CHG-0027).

/** One live `claude -p` stream-json process owned by a pooled thread. */
export interface ClaudeConnection extends HarnessConnection {
  /**
   * What the process says between turns (probe of 2026-11-20, Claude Code 2.1.328): the background tasks it still runs, from `background_tasks_changed`, and whether a `task_notification` woke it and no turn has read that yet.
   */
  readonly background: { hasBackgroundWake: boolean; tasks: number };
  /** How the process was signed in, from the init event; Unknown until it reports (budget-control, Billing kind). */
  billing: BillingKind;
  /** Whether the process runs an API key account, whose turns are billed to its key whatever Claude Code's init event says of a token (it reports `none` for `ANTHROPIC_AUTH_TOKEN`; probe of 2026-11-27, 2.1.330). */
  readonly isKeyAccount: boolean;
  /** The cost Claude Code last reported for this process, which it adds up across turns (provisional, unprobed). */
  lastTotalCost: number;
  readonly process: StreamJsonProcess;
}

/** The turn's own cost from the result's running total; a total that fell means a fresh count. */
const turnCostOf = (connection: ClaudeConnection, total: unknown): number | null => {
  if (typeof total !== "number" || !Number.isFinite(total)) return null;
  const cost = total >= connection.lastTotalCost ? total - connection.lastTotalCost : total;
  connection.lastTotalCost = total;
  return Math.round(cost * 1e6) / 1e6;
};

/** A user message's content: the text alone, or the text then one base64 image block per image (message-attachments). */
export const claudeMessageContentOf = Effect.fnUntraced(function* (
  text: string,
  images: ReadonlyArray<ImageAttachment>,
) {
  if (images.length === 0) return text;
  const read = yield* readImages(images);
  return [
    { text, type: "text" },
    ...read.map((image) => ({
      source: { data: image.data, media_type: image.mediaType, type: "base64" },
      type: "image",
    })),
  ];
});

/** Runs one turn against a live Claude Code stream-json process until its result event. */
export const runClaudeTurn = Effect.fnUntraced(function* (
  connection: ClaudeConnection,
  request: TurnRequest,
  turn: PooledTurn,
  reports: Map<string, PlanLimitsReport>,
) {
  const promptId = request.isBackgroundWake === true ? null : crypto.randomUUID();
  if (promptId !== null) {
    const content = yield* claudeMessageContentOf(turnMessageOf(request), request.images);
    connection.process.write({ message: { content, role: "user" }, type: "user", uuid: promptId });
  }
  let draft = "";
  let reportedError: string | null = null;
  let hasNoticedWake = false;
  let isPromptPending = promptId !== null;
  let hasWakeBeforePrompt = false;
  let totalUsage: TokenUsage | null = null;
  let totalCost: number | null = null;
  // The latest call's own usage is the context then; the result's usage sums every call of the turn.
  let context: number | null = null;
  // The model that wrote the latest reply, which names its entry in the result's `modelUsage`.
  let replyModel: string | null = null;
  for (;;) {
    const item = yield* Queue.take(connection.process.incoming);
    if (item._tag === "Exit") return yield* new HarnessFailure({ reason: item.reason });
    const event = item.message;
    const type = textFieldOf(event, "type");
    if (type === "system" && textFieldOf(event, "subtype") === "init") {
      connection.billing = connection.isKeyAccount ? "ApiKey" : billingOf(event, connection.billing);
      // Without its thread tools the turn could not reach Outlore: it fails, with Retry, instead of running blind.
      const toolFailure = toolServerFailureOf(event, toolServerName);
      if (toolFailure !== null) return yield* new HarnessFailure({ reason: toolFailure });
    } else if (type === "system" && textFieldOf(event, "subtype") === "task_notification") {
      // A turn takes in the wake, whether it began the turn or arrived during it.
      connection.background.hasBackgroundWake = false;
      if (isPromptPending) hasWakeBeforePrompt = true;
      const notice =
        !hasNoticedWake && (request.isBackgroundWake === true || hasWakeBeforePrompt)
          ? backgroundTaskNoticeOf(event)
          : null;
      if (notice !== null) yield* request.onEvent({ _tag: "Notice", text: notice });
      hasNoticedWake = true;
    } else if (type === "system" && textFieldOf(event, "subtype") === "compact_boundary") {
      // Claude Code compacted the conversation: a line in the thread says so, where the context then falls.
      const notice = compactionNoticeOf(event);
      if (notice !== null) yield* request.onEvent({ _tag: "Notice", text: notice });
    } else if (type === "control_request") {
      // Inside the enforced sandbox a blocked host is allowed (CHG-0208): the sandbox contains file and process damage, and egress is open.
      // Only that one ask is answered; every other ask, such as a Bash call outside the sandbox, is left to the permission prompt tool, and none is answered without a sandbox.
      const askedRequest = fieldOf(event, "request");
      const host = request.access.containment === "Sandboxed" ? networkHostOf(askedRequest) : null;
      const requestId = textFieldOf(event, "request_id");
      if (host !== null && requestId !== null)
        connection.process.write({
          response: {
            request_id: requestId,
            response: { behavior: "allow", updatedInput: fieldOf(askedRequest, "input") },
            subtype: "success",
          },
          type: "control_response",
        });
    } else if (type === "rate_limit_event") {
      // Kept for the plan's limits, which then cost no read of their own.
      const report = planLimitsOf(event, connection.billing);
      if (report !== null) reports.set(request.configDirectory ?? "", report);
    } else if (type === "user") {
      // The initial prompt echo identifies the result boundary, while steered message echoes confirm delivery.
      const uuid = textFieldOf(event, "uuid");
      if (uuid !== null && uuid === promptId) isPromptPending = false;
      else if (uuid !== null) yield* turn.deliver(uuid);
    } else if (type === "stream_event") {
      const inner = fieldOf(event, "event");
      const innerType = textFieldOf(inner, "type");
      const delta = fieldOf(inner, "delta");
      if (innerType === "message_start") draft = "";
      if (innerType === "content_block_delta" && textFieldOf(delta, "type") === "text_delta") {
        draft += textFieldOf(delta, "text") ?? "";
        yield* request.onEvent({ _tag: "Draft", text: draft });
      }
    } else if (type === "assistant") {
      const message = fieldOf(event, "message");
      const text = textOf(fieldOf(message, "content"));
      const error = fieldOf(event, "error");
      replyModel = reportedModelOf(message) ?? replyModel;
      const callUsage = usageOf(fieldOf(message, "usage"));
      const callContext = contextOf(callUsage);
      // A synthetic message reports zeros, which are no measure.
      if (callContext !== null && callContext > 0) context = callContext;
      draft = "";
      // Each tool call is a step of the turn, shown as it starts (action-approval).
      for (const call of toolCallsOf(fieldOf(message, "content"))) {
        yield* request.onEvent(yield* claudeToolCallOf(call, request.cwd));
      }
      // A synthetic assistant message carrying `error` reports a failure, not a reply.
      if (error !== undefined && error !== null) reportedError = text || String(error);
      else if (text.trim() !== "")
        yield* request.onEvent({
          _tag: "Reply",
          model: reportedModelOf(message),
          text,
          usage: callUsage !== null && callContext !== null && callContext > 0 ? callUsage : null,
        });
    } else if (type === "result") {
      // An interrupted turn ends with an error result, which is no failure (probe of 2026-11-06).
      totalUsage = addUsage(totalUsage, usageOf(fieldOf(event, "usage")));
      const cost = turnCostOf(connection, fieldOf(event, "total_cost_usd"));
      if (cost !== null) totalCost = Math.round(((totalCost ?? 0) + cost) * 1e6) / 1e6;
      const contextWindow = reportedWindowOf(fieldOf(event, "modelUsage"), replyModel);
      if (turn.isInterrupting())
        return {
          billing: connection.billing,
          context,
          contextWindow,
          cost: totalCost,
          isInterrupted: true,
          usage: totalUsage,
        };
      // A background command can wake Claude before it takes the prompt, and that wake has its own result.
      if (hasWakeBeforePrompt && isPromptPending) {
        hasWakeBeforePrompt = false;
        hasNoticedWake = false;
        reportedError = null;
        continue;
      }
      if (fieldOf(event, "is_error") === true || reportedError !== null)
        return yield* new HarnessFailure({ reason: failureReasonOf(event, reportedError) });
      return {
        billing: connection.billing,
        context,
        contextWindow,
        cost: totalCost,
        isInterrupted: false,
        usage: totalUsage,
      };
    }
  }
});

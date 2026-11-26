import type { TokenUsage } from "@outlore/contracts";
import { Effect, Result } from "effect";
import {
  fieldOf,
  HarnessFailure,
  type RpcIncoming,
  readImages,
  type TurnRequest,
  textFieldOf,
  turnMessageOf,
} from "../core/index.ts";
import type { AcpConnection, AcpDialect } from "./acpDialect.ts";
import { answerAcpRequest } from "./acpPermissions.ts";
import { openAcpPromptFlight, readAcpPrompt } from "./acpPrompt.ts";
import { acpCumulativeUsageDeltaOf, acpPromptUsageOf, acpUpdateUsageOf } from "./acpSession.ts";
import { acpFileEditsOf } from "./fileEditEvents.ts";
import type { PooledTurn } from "./harnessProcesses.ts";
import { addUsage, contextOf } from "./tokenUsage.ts";

/** Runs one turn on the thread's ACP session: one prompt, or a flight of prompts when the owner steers, read until the last answer. */
export const runAcpTurn = (dialect: AcpDialect) =>
  Effect.fnUntraced(function* (connection: AcpConnection, request: TurnRequest, turn: PooledTurn) {
    // A fresh session's first prompt carries the starting context; a reopened one already holds it.
    const context = connection.contextToGive;
    const notes = connection.handoverNotes;
    connection.contextToGive = null;
    connection.handoverNotes = null;
    let text = turnMessageOf(request);
    if (notes !== null) text = `${notes}\n\n${text}`;
    if (context !== null) text = `${context}\n\n${text}`;
    const images = yield* readImages(request.images);
    if (images.length > 0 && connection.canTakeImages === false)
      return yield* new HarnessFailure({
        reason: `${dialect.label}'s agent does not take images. Send the message without them, or hand the thread to a runner that does.`,
      });
    // The refusals of the owner that the agent has not heard yet: see `shouldRepromptRefusals`.
    const refusals: Array<string> = [];
    let usage: TokenUsage | null = null;
    // One prompt, whose updates are read until its answer; a message steered into it makes it a flight of prompts, read until the last one is answered.
    // The turn's images go with its first prompt only.
    const readPrompt = Effect.fnUntraced(function* (promptText: string, promptImages: typeof images) {
      let draft = "";
      let inlineFailure: string | null = null;
      /** What the flight's prompts have reported so far, each counted once; null until one reports usage. */
      let flightUsage: TokenUsage | null = null;
      /** A prompt's usage counts in the flight's, and the prompt's own reading is returned. */
      const countUsage = (answer: unknown) => {
        const reported = acpPromptUsageOf(fieldOf(answer, "usage"));
        if (reported !== null) {
          if (dialect.usage === "cumulative") {
            const { delta, next } = acpCumulativeUsageDeltaOf(connection.lastUsage, reported);
            connection.lastUsage = next;
            flightUsage = addUsage(flightUsage, delta);
          } else flightUsage = addUsage(flightUsage, reported);
        }
        return reported;
      };
      /** The agent has taken the messages steered so far into the turn. */
      const deliverSteered = Effect.suspend(() =>
        Effect.forEach(connection.steered.splice(0), (id) => turn.deliver(id), { discard: true }),
      );
      /** A reply is complete once the agent moves on from writing it, such as to a tool call. */
      const finishDraft = Effect.suspend(() => {
        let reply = draft;
        draft = "";
        if (dialect.inlineFailurePattern !== undefined) {
          const match = dialect.inlineFailurePattern.exec(reply);
          if (match !== null) {
            inlineFailure = match[0].trim();
            reply = reply.replace(dialect.inlineFailurePattern, "").trim();
          }
        }
        return reply.trim() === "" ? Effect.void : request.onEvent({ _tag: "Reply", text: reply });
      });
      let contextTokens: number | null = null;
      let contextWindow: number | null = null;
      let updateUsage: TokenUsage | null = null;
      const read = Effect.fnUntraced(function* (incoming: RpcIncoming) {
        if (incoming._tag === "Exit") return yield* new HarnessFailure({ reason: incoming.reason });
        if (incoming._tag === "Request")
          return yield* turn.fork(answerAcpRequest(connection, dialect, request, incoming, refusals));
        if (incoming.method !== "session/update") return;
        if (textFieldOf(incoming.params, "sessionId") !== connection.sessionId) return;
        const update = fieldOf(incoming.params, "update");
        const kind = textFieldOf(update, "sessionUpdate");
        if (kind === "agent_message_chunk") {
          draft += textFieldOf(fieldOf(update, "content"), "text") ?? "";
          yield* request.onEvent({ _tag: "Draft", text: draft });
        } else if (kind === "tool_call" || kind === "tool_call_update") {
          const id = textFieldOf(update, "toolCallId");
          if (id !== null) connection.toolCalls.set(id, update);
          if (kind === "tool_call") {
            yield* finishDraft;
            if (dialect.shouldAnnounceToolCalls !== false)
              yield* request.onEvent({
                _tag: "ToolCall",
                id: id ?? "",
                input: fieldOf(update, "rawInput") ?? {},
                toolName: textFieldOf(update, "title") ?? textFieldOf(update, "kind") ?? "tool",
              });
          }
          for (const event of acpFileEditsOf(update, connection.sessionId, dialect.fileEdits))
            yield* request.onEvent(event);
        } else if (kind === "usage_update") {
          // The standard fields name the context's size; a provider may add token fields of its own.
          const used = fieldOf(update, "used");
          if (typeof used === "number") contextTokens = used;
          const size = fieldOf(update, "size");
          if (typeof size === "number" && size > 0) contextWindow = size;
          updateUsage = addUsage(updateUsage, acpUpdateUsageOf(update));
        }
      });

      const flight = openAcpPromptFlight();
      connection.flight = flight;
      const ended = yield* readAcpPrompt(connection.rpc, connection.sessionId, promptText, promptImages, read, {
        flight,
        // The agent answered the prompt before it, which carried the turn on under the steered one: the steered message is taken in,
        // the reply written so far is complete, and what the prompt used counts at once, so a failure of the last prompt keeps it.
        onSuperseded: (answer) =>
          Effect.gen(function* () {
            countUsage(answer);
            turn.reportUsage(addUsage(usage, flightUsage));
            yield* finishDraft;
            yield* deliverSteered;
          }),
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            connection.flight = null;
            connection.steered.splice(0);
          }),
        ),
      );
      yield* finishDraft;
      if (Result.isFailure(ended.answer)) return yield* ended.answer.failure;
      if (inlineFailure !== null) return yield* new HarnessFailure({ reason: inlineFailure });
      // An answer to the last prompt, even a cancelled one, shows the agent had taken the steered messages in.
      yield* deliverSteered;
      const reported = countUsage(ended.answer.success);
      return {
        context: dialect.isContextFromUsage === true ? contextOf(reported) : contextTokens,
        contextWindow,
        isCancelled: textFieldOf(ended.answer.success, "stopReason") === "cancelled",
        usage: flightUsage ?? (dialect.usage === "cumulative" ? null : updateUsage),
      };
    });

    let end = yield* readPrompt(text, images);
    for (;;) {
      usage = addUsage(usage, end.usage);
      // Each prompt's usage counts at once, so a later prompt that fails keeps what the earlier ones used.
      turn.reportUsage(usage);
      if (
        !(dialect.shouldRepromptRefusals === true && end.isCancelled && refusals.length > 0 && !turn.isInterrupting())
      )
        break;
      end = yield* readPrompt(refusals.splice(0).join("\n"), []);
    }
    return {
      ...(connection.billing === null ? {} : { billing: connection.billing }),
      // The latest prompt's own reading stands for the context: the sum of usage covers every prompt of the turn.
      context: end.context,
      contextWindow: end.contextWindow,
      isInterrupted: end.isCancelled || turn.isInterrupting(),
      usage,
    };
  });

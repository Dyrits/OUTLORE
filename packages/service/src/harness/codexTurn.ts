import { Effect, Queue } from "effect";
import { fieldOf, HarnessFailure, type RpcIncoming, type TurnRequest, textFieldOf } from "../core/index.ts";
import { codexAnswersOf, codexChoicesOf } from "./codexChoices.ts";
import { type CodexConnection, contextOf, contextWindowOf, usageOf } from "./codexProtocol.ts";
import { codexFileEditsOf } from "./fileEditEvents.ts";
import type { PooledTurn } from "./harnessProcesses.ts";
import { toolServerName } from "./toolNames.ts";

// Codex app-server turn reading and reverse-request approval handling (ADR 0008).

/** The files of a file change item, for its approval question. */
const changedPathsOf = (item: unknown) => {
  const changes = fieldOf(item, "changes");
  return Array.isArray(changes) ? changes.flatMap((change) => textFieldOf(change, "path") ?? []) : [];
};

/** Answers one of Codex's own requests, which may wait on the owner without a time limit. */
const answerRequest = Effect.fnUntraced(function* (
  connection: CodexConnection,
  request: TurnRequest,
  incoming: Extract<RpcIncoming, { _tag: "Request" }>,
  fileChanges: Map<string, ReadonlyArray<string>>,
) {
  const { id, method, params } = incoming;
  const { rpc } = connection;
  // At the default level Codex asks only to go beyond its sandbox, so each of its requests is an escape.
  // At "Also commands and edits" it asks before commands it does not trust, which run inside the sandbox once allowed.
  const isEscape = request.access.approvalLevel === "RiskyOnly";
  const ask = (toolName: string, input: object) =>
    request
      .askOwner({ input, ...(isEscape ? { isOutsideSandbox: true } : {}), toolName })
      .pipe(Effect.map((answer) => answer.isAllowed));
  if (method === "item/commandExecution/requestApproval") {
    const isAllowed = yield* ask("Bash", {
      command: textFieldOf(params, "command") ?? "",
      description: textFieldOf(params, "reason") ?? "",
    });
    return rpc.respond(id, { decision: isAllowed ? "accept" : "decline" });
  }
  if (method === "item/fileChange/requestApproval") {
    const paths = fileChanges.get(textFieldOf(params, "itemId") ?? "") ?? [];
    const isAllowed = yield* ask("Edit", {
      description: textFieldOf(params, "reason") ?? "",
      file_path: paths.join(", ") || (textFieldOf(params, "grantRoot") ?? "a file"),
    });
    return rpc.respond(id, { decision: isAllowed ? "accept" : "decline" });
  }
  if (method === "item/permissions/requestApproval") {
    const isAllowed = yield* ask("Permissions", {
      description: textFieldOf(params, "reason") ?? "Widen the sandbox",
      query: JSON.stringify(fieldOf(params, "permissions") ?? {}),
    });
    return rpc.respond(id, { permissions: isAllowed ? (fieldOf(params, "permissions") ?? {}) : {}, scope: "turn" });
  }
  // Outlore's own tools need no confirmation; another server's question is declined.
  if (method === "mcpServer/elicitation/request") {
    const isOwn = textFieldOf(params, "serverName") === toolServerName;
    return rpc.respond(id, { _meta: null, action: isOwn ? "accept" : "decline", content: null });
  }
  if (method === "item/tool/requestUserInput") {
    const questions = codexChoicesOf(params);
    if (questions === null) return rpc.respond(id, { answers: {} });
    const answer = yield* request.askOwner({
      choices: questions.map((question) => question.choice),
      input: params,
      toolName: "request_user_input",
    });
    return rpc.respond(id, codexAnswersOf(questions, answer.isAllowed ? (answer.answers ?? null) : null));
  }
  return rpc.respondError(id, `Outlore does not answer ${method}.`);
});

/** Reads Codex's notifications for one turn until its completion. */
export const readCodexTurn = Effect.fnUntraced(function* (
  connection: CodexConnection,
  request: TurnRequest,
  turn: PooledTurn,
  codexTurnId: string,
) {
  const calls: Array<unknown> = [];
  let contextWindow: number | null = null;
  const fileChanges = new Map<string, ReadonlyArray<string>>();
  let draft = "";
  for (;;) {
    const incoming = yield* Queue.take(connection.rpc.incoming);
    if (incoming._tag === "Exit") return yield* new HarnessFailure({ reason: incoming.reason });
    if (incoming._tag === "Request") {
      // Answered beside the turn: a question may wait on the owner while events keep coming.
      yield* turn.fork(answerRequest(connection, request, incoming, fileChanges));
      continue;
    }
    const { method, params } = incoming;
    // Without its thread tools the turn could not reach Outlore: it fails, with Retry, instead of running blind.
    // The status carries a thread id, or none when it speaks for the process.
    if (
      method === "mcpServer/startupStatus/updated" &&
      textFieldOf(params, "name") === toolServerName &&
      textFieldOf(params, "status") === "failed" &&
      [connection.sessionId, null].includes(textFieldOf(params, "threadId"))
    )
      return yield* new HarnessFailure({
        reason: `Outlore's thread tools did not load: Codex reports its server "${toolServerName}" as failed${
          textFieldOf(params, "error") === null ? "" : ` (${textFieldOf(params, "error")})`
        }. Retry once it can start.`,
      });
    if (textFieldOf(params, "threadId") !== connection.sessionId) continue;
    const item = fieldOf(params, "item");
    const itemType = textFieldOf(item, "type");
    if (method === "item/started" && itemType === "userMessage") {
      const clientId = textFieldOf(item, "clientId");
      if (clientId !== null) yield* turn.deliver(clientId);
    } else if (method === "item/started" && itemType === "agentMessage") {
      draft = "";
    } else if (method === "item/started" && itemType === "fileChange") {
      fileChanges.set(textFieldOf(item, "id") ?? "", changedPathsOf(item));
    } else if (
      method === "item/completed" &&
      itemType === "fileChange" &&
      textFieldOf(params, "turnId") === codexTurnId
    ) {
      for (const event of codexFileEditsOf(item, codexTurnId)) yield* request.onEvent(event);
    } else if (method === "item/agentMessage/delta") {
      draft += textFieldOf(params, "delta") ?? "";
      yield* request.onEvent({ _tag: "Draft", text: draft });
    } else if (method === "item/completed" && itemType === "agentMessage") {
      const text = textFieldOf(item, "text") ?? "";
      draft = "";
      if (text.trim() !== "") yield* request.onEvent({ _tag: "Reply", text });
    } else if (method === "thread/tokenUsage/updated") {
      const tokenUsage = fieldOf(params, "tokenUsage");
      calls.push(fieldOf(tokenUsage, "last"));
      contextWindow = contextWindowOf(tokenUsage) ?? contextWindow;
      turn.reportUsage(usageOf(calls));
    } else if (method === "turn/completed") {
      const completed = fieldOf(params, "turn");
      if (textFieldOf(completed, "id") !== codexTurnId) continue;
      const status = textFieldOf(completed, "status");
      if (status === "interrupted" || turn.isInterrupting())
        return {
          billing: connection.billing,
          context: contextOf(calls),
          contextWindow,
          isInterrupted: true,
          usage: usageOf(calls),
        };
      if (status === "failed") {
        return yield* new HarnessFailure({
          reason: textFieldOf(fieldOf(completed, "error"), "message") ?? "Codex reported a failed turn.",
        });
      }
      return {
        billing: connection.billing,
        context: contextOf(calls),
        contextWindow,
        isInterrupted: false,
        usage: usageOf(calls),
      };
    }
  }
});

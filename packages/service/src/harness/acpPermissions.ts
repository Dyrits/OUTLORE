import type { Choice } from "@outlore/contracts";
import { Effect } from "effect";
import { fieldOf, type RpcIncoming, type RpcProcess, type TurnRequest, textFieldOf } from "../core/index.ts";
import type { AcpDialect, AcpLaunch } from "./acpHarness.ts";
import { permissionOptionIdOf } from "./acpSession.ts";
import { findFirstOutside, promptOf, refusalOf } from "./openCodePrompts.ts";

/** What a dialect's `promptOf` decides the owner's question from. */
export type AcpPermissionContext = {
  readonly launch: AcpLaunch;
  readonly request: TurnRequest;
  readonly rpc: RpcProcess;
  /** The tool call the permission request names, as far as the session's updates and the request itself say. */
  readonly toolCall: unknown;
};

/** The state a reverse-request handler reads from its connection. */
export type AcpPermissionConnection = {
  readonly launch: AcpLaunch;
  readonly rpc: RpcProcess;
  readonly toolCalls: ReadonlyMap<string, unknown>;
};

/**
 * A question the agent asks through a permission request, as the owner chooses an answer to it.
 * The agent's own options are the choices, each answered by its id; no answer, or text naming none of them, answers cancelled,
 * so the agent never hears an option the owner did not pick.
 */
const answerQuestion = Effect.fnUntraced(function* (
  connection: AcpPermissionConnection,
  dialect: AcpDialect,
  request: TurnRequest,
  incoming: Extract<RpcIncoming, { _tag: "Request" }>,
  toolCall: unknown,
) {
  const offered = fieldOf(incoming.params, "options");
  const options = Array.isArray(offered)
    ? offered.flatMap((option) => {
        const optionId = textFieldOf(option, "optionId");
        const name = textFieldOf(option, "name") ?? optionId;
        return optionId === null || name === null ? [] : [{ name, optionId }];
      })
    : [];
  const question = textFieldOf(toolCall, "title") ?? "Choose an option";
  const choice = {
    allowsOther: false,
    header: dialect.label,
    multiple: false,
    options: options.map((option) => ({ description: "", label: option.name })),
    question,
  } satisfies typeof Choice.Type;
  const answer = yield* request.askOwner({
    choices: [choice],
    input: { options: options.map((option) => option.name), question },
    toolName: "request_user_input",
  });
  const chosen = answer.isAllowed ? answer.answers?.[0]?.[0] : undefined;
  const picked = options.find((option) => option.name === chosen);
  connection.rpc.respond(
    incoming.id,
    picked === undefined
      ? { outcome: { outcome: "cancelled" } }
      : { outcome: { optionId: picked.optionId, outcome: "selected" } },
  );
});

/** The question the owner is asked about a tool call: the call, naming the first file it edits outside the thread's folder. */
const standardPromptOf = Effect.fnUntraced(function* ({ request, toolCall }: AcpPermissionContext) {
  return promptOf(toolCall, yield* findFirstOutside(request, toolCall));
});

/**
 * Answers one of the agent's reverse requests: a permission request goes to the owner, any other fails closed.
 * Some agents name only the tool call's id, so the call is read from the session updates seen so far, with what the request itself says on top.
 * A denial is answered with the agent's reject option and the turn carries on without the action;
 * where the agent cancels its prompt for a refusal, the refusal is added to `refusals` before the agent hears it.
 */
export const answerAcpRequest = Effect.fnUntraced(function* (
  connection: AcpPermissionConnection,
  dialect: AcpDialect,
  request: TurnRequest,
  incoming: Extract<RpcIncoming, { _tag: "Request" }>,
  refusals: Array<string>,
) {
  if (incoming.method !== "session/request_permission")
    return connection.rpc.respondError(incoming.id, `Outlore does not answer ${incoming.method}.`);
  const named = fieldOf(incoming.params, "toolCall");
  const toolCallId = textFieldOf(named, "toolCallId");
  const seen = toolCallId === null ? undefined : connection.toolCalls.get(toolCallId);
  const toolCall = seen === undefined || seen === null ? named : { ...(seen as object), ...(named as object) };
  if (dialect.questionIdPrefix !== null && toolCallId?.startsWith(dialect.questionIdPrefix) === true)
    return yield* answerQuestion(connection, dialect, request, incoming, toolCall);
  const context = { launch: connection.launch, request, rpc: connection.rpc, toolCall } satisfies AcpPermissionContext;
  const prompt = yield* (dialect.promptOf ?? standardPromptOf)(context);
  const answer = yield* request.askOwner(prompt);
  if (!answer.isAllowed && dialect.repromptsRefusals === true) refusals.push(refusalOf(prompt, answer));
  const optionId = permissionOptionIdOf(incoming.params, answer.isAllowed ? "allow_once" : "reject_once");
  // An agent that offers no such option hears the request cancelled, never an option id it did not offer.
  connection.rpc.respond(
    incoming.id,
    optionId === null ? { outcome: { outcome: "cancelled" } } : { outcome: { optionId, outcome: "selected" } },
  );
});

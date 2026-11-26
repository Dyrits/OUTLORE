import { Effect, Result } from "effect";
import { fieldOf, HarnessFailure, type TurnRequest, textFieldOf } from "../core/index.ts";
import type { AcpConnection, AcpHarnessOptions } from "./acpDialect.ts";
import { checkAcpAgentVersion, startAcpRpcProcess } from "./acpLaunch.ts";
import {
  acpAgentVersionOf,
  acpInitializeParams,
  acpToolServersOf,
  acpVersionAtLeast,
  configOptionIdsOf,
  modeIdsOf,
  reopenAcpSession,
  thinkingConfigIdOf,
} from "./acpSession.ts";
import { noToolServerInstructions } from "./instructions.ts";

/** The line a thread shows when the agent could not pick up the thread's earlier session. */
const lostSessionNoteOf = (label: string) =>
  `${label} could not pick up this thread's earlier conversation: it is not in the provider's own folder for ` +
  "this account. The thread carries on in a new session, which was given the thread's conversation so far, as " +
  "when a thread changes harness.";

/** Starts the agent process for a thread and opens, reopens or replaces its ACP session, ready for the first prompt. */
export const startAcpConnection = (options: AcpHarnessOptions) => {
  const { dialect } = options;
  return Effect.fnUntraced(function* (request: TurnRequest) {
    const launch = yield* dialect.launchOf(request);
    const rpc = yield* startAcpRpcProcess({
      args: launch.command === undefined ? [...(options.prefixArgs ?? []), ...launch.args] : launch.args,
      command: launch.command ?? options.command,
      cwd: request.cwd,
      env: launch.env,
      ...(dialect.hasIsolatedTempDir === true ? { hasIsolatedTempDir: true } : {}),
      label: dialect.label,
      ...(launch.onEnded === undefined ? {} : { onEnded: launch.onEnded }),
    });
    let canSteerWithPrompt = false;
    const session = yield* Effect.gen(function* () {
      const initialized = yield* rpc.request("initialize", acpInitializeParams);
      yield* checkAcpAgentVersion(initialized, dialect.minimumAgentVersion, dialect.label);
      canSteerWithPrompt =
        dialect.steersWithPromptFrom !== undefined &&
        acpVersionAtLeast(acpAgentVersionOf(initialized), dialect.steersWithPromptFrom);
      const capabilities = fieldOf(initialized, "agentCapabilities");
      // A launch that hands the tool server over itself gives the session none, and the agent already has its context.
      const mcpServers =
        dialect.toolServer === "launch"
          ? []
          : yield* acpToolServersOf(
              dialect.toolServer,
              request.access,
              fieldOf(fieldOf(capabilities, "mcpCapabilities"), "http") === true,
            );
      const hasToolServer = dialect.toolServer === "launch" || mcpServers.length > 0;
      const advertisesImages = fieldOf(fieldOf(capabilities, "promptCapabilities"), "image");
      const canTakeImages = typeof advertisesImages === "boolean" ? advertisesImages : null;
      const resume = fieldOf(fieldOf(capabilities, "sessionCapabilities"), "resume");
      const canResume = dialect.canResumeSessions && resume !== undefined && resume !== null && resume !== false;
      // The starting context promises the thread tools; a session given no tool server is told they are not there.
      const startingContext = hasToolServer ? request.context : `${request.context}\n\n${noToolServerInstructions}`;
      const namespace = dialect.systemPromptNamespace;
      const isAppended =
        namespace !== undefined &&
        fieldOf(fieldOf(fieldOf(fieldOf(capabilities, "_meta"), namespace), "systemPrompt"), "append") === true;
      const newSession = rpc.request("session/new", {
        cwd: request.cwd,
        mcpServers,
        ...(isAppended ? { _meta: { [namespace]: { systemPrompt: { append: startingContext } } } } : {}),
      });
      if (request.sessionId !== null) {
        const reopened = yield* reopenAcpSession(rpc, {
          canResume,
          cwd: request.cwd,
          mcpServers,
          sessionId: request.sessionId,
        });
        if (Result.isSuccess(reopened))
          return {
            canTakeImages,
            created: reopened.success,
            handoverNotes: null,
            isAppended,
            isNew: false,
            startingContext,
          };
        // A session the agent cannot open is replaced by a new one, given the thread's conversation so far,
        // unless the dialect fails the turn instead or the process is gone.
        if (dialect.mayReplaceLostSession?.(launch) === false || rpc.hasExited()) return yield* reopened.failure;
        const created = yield* newSession;
        yield* request.onEvent({ _tag: "Notice", text: dialect.lostSessionNote ?? lostSessionNoteOf(dialect.label) });
        return {
          canTakeImages,
          created,
          handoverNotes: yield* request.conversationSoFar,
          isAppended,
          isNew: true,
          startingContext,
        };
      }
      const created = yield* newSession;
      return { canTakeImages, created, handoverNotes: null, isAppended, isNew: true, startingContext };
    }).pipe(Effect.tapError(() => Effect.sync(() => rpc.close())));
    // A reopened session's answer carries no id (the session is the one the request named); a new one's does.
    const sessionId = session.isNew ? textFieldOf(session.created, "sessionId") : request.sessionId;
    if (sessionId === null) {
      rpc.close();
      return yield* new HarnessFailure({ reason: `${dialect.label} started no session.` });
    }
    // Every tool call asks, so Outlore decides each one: the session runs in its "ask" mode when it offers one,
    // and never a mode that would answer permissions itself (Antigravity rejects yolo and auto_edit besides).
    if (modeIdsOf(fieldOf(session.created, "modes")).includes("ask"))
      yield* rpc
        .request("session/set_config_option", { configId: "mode", sessionId, value: "ask" })
        .pipe(Effect.ignore);
    // The model and the thinking level are set only where the session offered them; a refusal ends the start.
    const offered = configOptionIdsOf(fieldOf(session.created, "configOptions"));
    const setOption = (configId: string, value: string) =>
      rpc.request("session/set_config_option", { configId, sessionId, value }).pipe(
        Effect.tapError(() => Effect.sync(() => rpc.close())),
        Effect.mapError(
          (failure) =>
            new HarnessFailure({ reason: `${dialect.label} refused the ${configId} ${value}: ${failure.reason}` }),
        ),
      );
    const isAlways = dialect.setsOptions === "always";
    if (request.model !== "default" && (isAlways || offered.includes("model")))
      yield* setOption("model", request.model);
    // The effort is an option of the session's model, which an "always" dialect lists only once the model is chosen.
    const thinkingId = isAlways ? "effort" : thinkingConfigIdOf(fieldOf(session.created, "configOptions"));
    if (request.effort !== "default" && thinkingId !== null) yield* setOption(thinkingId, request.effort);
    const billing = dialect.readBilling === undefined ? null : yield* dialect.readBilling(rpc, sessionId);
    return {
      billing,
      canSteerWithPrompt,
      canTakeImages: session.canTakeImages,
      close: rpc.close,
      // A launch that gave the context itself, or a session given it as its system prompt, leaves nothing for the first prompt.
      contextToGive:
        session.isNew && dialect.toolServer !== "launch" && !session.isAppended ? session.startingContext : null,
      flight: null,
      handoverNotes: session.handoverNotes,
      hasExited: rpc.hasExited,
      lastUsage: { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 },
      launch,
      rpc,
      sessionId,
      steered: [],
      toolCalls: new Map(),
    } satisfies AcpConnection;
  });
};

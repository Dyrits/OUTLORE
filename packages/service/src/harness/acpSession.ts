import { Effect, Queue } from "effect";
import { fieldOf, type TurnRequest, textFieldOf } from "../core/index.ts";
import type { RpcProcess } from "./lineProcess.ts";

/** Identifies the settings that require a running ACP process to reload its session. */
export const acpRestartKeyOf = (request: TurnRequest) =>
  JSON.stringify([
    request.context,
    request.access,
    request.configDirectory,
    request.model,
    request.effort,
    request.cwd,
  ]);

/** Loads an ACP session and drops updates replayed from its earlier conversation. */
export const loadAcpSession = Effect.fnUntraced(function* (
  rpc: RpcProcess,
  cwd: string,
  sessionId: string,
  mcpServers: ReadonlyArray<object>,
) {
  const result = yield* rpc.request("session/load", { cwd, mcpServers, sessionId }).pipe(Effect.result);
  yield* Queue.clear(rpc.incoming);
  return result;
});

/** Finds the option ID the ACP agent offered for a one-time permission answer. */
export const permissionOptionIdOf = (params: unknown, kind: "allow_once" | "reject_once") => {
  const options = fieldOf(params, "options");
  const option = Array.isArray(options) ? options.find((candidate) => textFieldOf(candidate, "kind") === kind) : null;
  return textFieldOf(option, "optionId");
};

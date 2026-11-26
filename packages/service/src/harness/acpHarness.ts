import { Effect } from "effect";
import { type Containment, type HarnessAdapter, readImages, type SteeredMessage } from "../core/index.ts";
import type { AcpConnection, AcpHarnessOptions } from "./acpDialect.ts";
import { steerAcpPrompt } from "./acpPrompt.ts";
import { acpRestartKeyOf } from "./acpSession.ts";
import { startAcpConnection } from "./acpStart.ts";
import { runAcpTurn } from "./acpTurn.ts";
import { type HarnessProtocol, makeHarnessProcesses } from "./harnessProcesses.ts";

export type { AcpDialect, AcpHarnessOptions } from "./acpDialect.ts";
export type { AcpLaunch } from "./acpLaunch.ts";
export type { AcpPermissionContext } from "./acpPermissions.ts";

/** The ACP protocol of one harness: one ACP session per Outlore thread, one prompt per turn. */
const acpProtocolOf = (options: AcpHarnessOptions): HarnessProtocol<AcpConnection> => {
  const { dialect } = options;

  return {
    interrupt: (connection) =>
      Effect.sync(() => {
        connection.rpc.notify("session/cancel", { sessionId: connection.sessionId });
        return true;
      }),

    // A changed context, access, account, model, effort, or folder restarts the process, loading its session.
    restartKeyOf: acpRestartKeyOf,

    runTurn: runAcpTurn(dialect),

    start: startAcpConnection(options),

    /**
     * Standard ACP takes no message into a running prompt, so a steered message waits for the next turn.
     * An agent the dialect knows takes a second prompt as one (`steersWithPromptFrom`) is sent it, and the message counts as taken in once the agent answers the prompt before it.
     */
    steer: Effect.fnUntraced(function* (connection: AcpConnection, message: SteeredMessage) {
      const flight = connection.flight;
      if (!connection.canSteerWithPrompt || flight === null) return false;
      // An unreadable image, or one the agent does not take, leaves the message for the next turn, where the turn itself says so.
      const images = yield* readImages(message.images).pipe(Effect.catch(() => Effect.succeed(null)));
      if (images === null || (images.length > 0 && connection.canTakeImages === false)) return false;
      connection.steered.push(message.id);
      const isSent = yield* steerAcpPrompt(flight, message.text, images);
      if (!isSent) {
        const index = connection.steered.indexOf(message.id);
        if (index >= 0) connection.steered.splice(index, 1);
      }
      return isSent;
    }),
  };
};

/**
 * Runs each thread in one long-lived process of an agent's ACP server, closed with the scope that made it.
 * These agents run without a sandbox Outlore enforces here, so the adapter reports Unprotected: every tool call it asks about asks the owner.
 */
export const makeAcpHarness = (options: AcpHarnessOptions) =>
  Effect.map(
    makeHarnessProcesses(acpProtocolOf(options), options),
    (adapter) => ({ ...adapter, containmentOf: (): Containment => "Unprotected" }) satisfies HarnessAdapter,
  );

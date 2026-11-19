import type {
  ChooseAppleApps,
  InstallConnector,
  ReadConnectorChoices,
  RemoveConnector,
  RequestApplePermission,
  SetConnectorSwitch,
  SetConnectorTool,
} from "@outlore/contracts";
import { Effect } from "effect";
import type { SqlError } from "effect/sql";
import type { Connectors } from "../connectors/index.ts";
import type { ServiceFailure } from "../core/index.ts";
import { type CommandRunner, changed } from "./commands.ts";

// The owner's connector requests (connectors specification; blueprint, Owner requests). All are the owner's: no thread tool
// reaches them. A change that can take a tool from a thread says so in its follow-ups, so the calls underway are stopped
// once it commits.

/** Connector request handlers: each writes in the command's transaction, then answers the connector's card. */
export const connectorHandlers = (commands: CommandRunner, connectors: Connectors["Service"]) => {
  /** Runs a change that may take a tool from a thread, then answers the card. */
  const stopping = (connectorId: string, change: Effect.Effect<void, ServiceFailure | SqlError.SqlError>) =>
    commands
      .run(change.pipe(Effect.map(() => changed(null, { shouldStopConnectorCalls: true }))))
      .pipe(Effect.andThen(connectors.card(connectorId)));
  return {
    ChooseAppleApps: (given: typeof ChooseAppleApps.Type) =>
      stopping(given.connectorId, connectors.chooseApps({ apps: given.apps, connectorId: given.connectorId })),
    InstallConnector: (given: typeof InstallConnector.Type) =>
      commands
        .run(
          connectors
            .install({
              ...(given.apps === undefined ? {} : { apps: given.apps }),
              connectorId: given.connectorId,
              hasConfirmedNotice: given.hasConfirmedNotice,
            })
            .pipe(Effect.map(() => changed(null))),
        )
        // The server is asked outside the transaction, which must not wait on a network: a refusal marks it Needs connecting.
        .pipe(
          Effect.andThen(connectors.refresh(given.connectorId)),
          Effect.andThen(connectors.card(given.connectorId)),
        ),
    ListConnectors: () => connectors.cards,
    ReadConnectorChoices: (given: typeof ReadConnectorChoices.Type) => connectors.choicesAt(given.level),
    RemoveConnector: (given: typeof RemoveConnector.Type) =>
      // Three steps that resume after a crash: unusable at once, then the Vault, then the rows and the permissions.
      stopping(given.connectorId, connectors.startRemoval(given.connectorId)).pipe(
        Effect.andThen(connectors.eraseSecrets(given.connectorId)),
        Effect.andThen(commands.run(connectors.finishRemoval(given.connectorId).pipe(Effect.map(() => changed(null))))),
        Effect.andThen(connectors.card(given.connectorId)),
      ),
    // Host-only by the request's source rule: a paired device is refused before this handler runs.
    RequestApplePermission: (given: typeof RequestApplePermission.Type) =>
      connectors.requestApplePermission(given.connectorId),
    SetConnectorSwitch: (given: typeof SetConnectorSwitch.Type) =>
      stopping(
        given.connectorId,
        connectors.setSwitch({ choice: given.choice, connectorId: given.connectorId, level: given.level }),
      ),
    SetConnectorTool: (given: typeof SetConnectorTool.Type) =>
      stopping(
        given.connectorId,
        connectors.setTool({ connectorId: given.connectorId, isOn: given.isOn, tool: given.tool }),
      ),
  };
};

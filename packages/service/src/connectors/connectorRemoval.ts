import type { ApplePermissionStatus } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { type Changes, ServiceFailure } from "../core/index.ts";
import { deleteConnector, readConnectorRecords } from "./connectorStore.ts";
import type { ToolListing } from "./toolListing.ts";
import type { VaultPort } from "./vaultPort.ts";

/** Dependencies needed to erase secrets and finish or resume connector removals. */
export type RemovalDependencies = {
  readonly bumpPermissionRevision: () => void;
  readonly changes: Changes["Service"];
  readonly listing: ToolListing;
  readonly permissions: Map<string, Map<string, ApplePermissionStatus>>;
  readonly sql: SqlClient.SqlClient;
  readonly vault: VaultPort["Service"];
};

/** Removes a connector's secrets from the Vault as the second step of removal. */
export const eraseConnectorSecrets = (dependencies: RemovalDependencies, connectorId: string) =>
  dependencies.vault.removeAllOf(connectorId).pipe(
    Effect.catchTag("VaultUnavailable", () =>
      Effect.fail(
        new ServiceFailure({
          kind: "ExecutionFailure",
          message:
            "Its secret could not be removed from the Vault, so the connector stays marked as being removed. Try again once the Vault answers.",
        }),
      ),
    ),
  );

/** Deletes a connector's stored rows, permissions, and cached backend as the final step of removal. */
export const finishConnectorRemoval = (dependencies: RemovalDependencies, connectorId: string) =>
  Effect.gen(function* () {
    dependencies.bumpPermissionRevision();
    dependencies.permissions.delete(connectorId);
    yield* dependencies.sql.withTransaction(
      deleteConnector(connectorId).pipe(Effect.provideService(SqlClient.SqlClient, dependencies.sql)),
    );
    yield* dependencies.listing.forget(connectorId);
    yield* dependencies.changes.publish;
  });

/** Resumes every removal a crash left halfway at its second step; one that cannot finish stays Removing. */
export const resumeConnectorRemovals = (dependencies: RemovalDependencies) =>
  Effect.gen(function* () {
    const provided = Effect.provideService(SqlClient.SqlClient, dependencies.sql);
    for (const record of yield* readConnectorRecords.pipe(provided)) {
      if (!record.isRemoving) continue;
      yield* eraseConnectorSecrets(dependencies, record.id).pipe(
        Effect.andThen(finishConnectorRemoval(dependencies, record.id)),
      );
    }
  }).pipe(Effect.ignore);

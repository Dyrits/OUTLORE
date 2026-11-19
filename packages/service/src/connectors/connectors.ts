import type {
  ApplePermissionReport,
  ConnectorCard,
  ConnectorChoiceCard,
  ConnectorChoiceLevel,
} from "@outlore/contracts";
import { Context, Effect, Layer } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { Changes, invalid, notFound, ServiceFailure } from "../core/index.ts";
import { applePermissionReportOf } from "./applePermission.ts";
import { ConnectorAsking, ConnectorNotices } from "./asking.ts";
import { isUsableBy } from "./availability.ts";
import { ConnectorBackends } from "./backend.ts";
import { ConnectorCalls } from "./calls.ts";
import { type CatalogEntry, defaultAppsOf, entryOf } from "./catalog.ts";
import { defaultCatalog } from "./catalogEntries.ts";
import { type CallDependencies, listOfferedTools, makeCall, markRefused, recordFailure } from "./connectorCall.ts";
import { type CardDependencies, cardOf } from "./connectorCards.ts";
import { choiceCardsOf } from "./connectorChoiceCards.ts";
import {
  chooseApps,
  installConnector,
  type OperationDependencies,
  setConnectorSwitch,
  setConnectorTool,
  startRemoval,
} from "./connectorOperations.ts";
import { type OfferedConnectorTool, readOfferedTools, readStanding } from "./connectorState.ts";
import {
  deleteConnector,
  readConnectorRecord,
  readConnectorRecords,
  readSubject,
  writeNeeds,
} from "./connectorStore.ts";
import { ConnectorGateway, type ConnectorTool } from "./gateway.ts";
import { failureOutcomeOf, makeToolListing } from "./toolListing.ts";
import { VaultPort } from "./vaultPort.ts";

/** What the owner's requests and a thread's turns ask of the connectors. */
export class Connectors extends Context.Service<
  Connectors,
  {
    /** A turn starts: see `ConnectorGateway.beginTurn`. */
    readonly beginTurn: ConnectorGateway["Service"]["beginTurn"];
    /** The card of one connector. */
    readonly card: (connectorId: string) => Effect.Effect<ConnectorCard, ServiceFailure | SqlError.SqlError>;
    /** Every connector the catalog offers, as cards. */
    readonly cards: Effect.Effect<ReadonlyArray<ConnectorCard>, SqlError.SqlError>;
    /** Every installed connector's own choice at one level, and what Inherit gives there: a realm's or a quest's panel. */
    readonly choicesAt: (
      level: ConnectorChoiceLevel,
    ) => Effect.Effect<ReadonlyArray<ConnectorChoiceCard>, ServiceFailure | SqlError.SqlError>;
    /** Chooses which apps are on. Runs in the command's transaction. */
    readonly chooseApps: (
      request: Parameters<typeof chooseApps>[1],
    ) => Effect.Effect<void, ServiceFailure | SqlError.SqlError>;
    /** Clears Needs connecting, as the owner gives the connector a new secret; the Vault's requests call it. */
    readonly clearNeeds: (connectorId: string) => Effect.Effect<void, SqlError.SqlError>;
    /** The last step of a removal: the connector's rows and permissions, and what is kept of its server. */
    readonly finishRemoval: (connectorId: string) => Effect.Effect<void, SqlError.SqlError>;
    /** Installs. Runs in the command's transaction; then `refresh` lists its tools. */
    readonly install: (
      request: Parameters<typeof installConnector>[1],
    ) => Effect.Effect<void, ServiceFailure | SqlError.SqlError>;
    /**
     * Asks macOS, through the connector's own child process, whether each chosen app allows Automation. The host's
     * own window only (RequestApplePermission is host-only).
     */
    readonly requestApplePermission: (
      connectorId: string,
    ) => Effect.Effect<ApplePermissionReport, ServiceFailure | SqlError.SqlError>;
    /** Asks a connector's server for its tools again, marking it Needs connecting when it refuses. */
    readonly refresh: (connectorId: string) => Effect.Effect<void, SqlError.SqlError>;
    /** The second step of a removal: the connector's secrets in the Vault, which fails when the Vault cannot answer. */
    readonly eraseSecrets: (connectorId: string) => Effect.Effect<void, ServiceFailure>;
    /** Resumes every removal a crash left halfway, at its second step; one that cannot finish stays Removing. */
    readonly resumeRemovals: Effect.Effect<void>;
    /** Sets a switch at one level. Runs in the command's transaction. */
    readonly setSwitch: (
      request: Parameters<typeof setConnectorSwitch>[1],
    ) => Effect.Effect<void, ServiceFailure | SqlError.SqlError>;
    /** Switches a tool. Runs in the command's transaction. */
    readonly setTool: (
      request: Parameters<typeof setConnectorTool>[1],
    ) => Effect.Effect<void, ServiceFailure | SqlError.SqlError>;
    /** The first step of a removal. Runs in the command's transaction. */
    readonly startRemoval: (connectorId: string) => Effect.Effect<void, ServiceFailure | SqlError.SqlError>;
    /** Stops the calls underway whose tool a committed change took from their thread. */
    readonly stopRevokedCalls: Effect.Effect<void>;
  }
>()("outlore/connectors/Connectors") {}

/** What the connectors are built over: the catalog the Charter offers and the host's platform. */
export type ConnectorsOptions = {
  readonly catalog?: ReadonlyArray<CatalogEntry>;
  readonly platform?: NodeJS.Platform;
};

type ConnectorsBuilt = Connectors["Service"] & { readonly gateway: ConnectorGateway["Service"] };

const toolOf = (tool: OfferedConnectorTool) =>
  ({
    connector: tool.connector,
    description: tool.description,
    inputSchema: tool.inputSchema,
    name: tool.listedName,
    tool: tool.tool,
  }) satisfies ConnectorTool;

const make = (options: ConnectorsOptions) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const changes = yield* Changes;
    const vault = yield* VaultPort;
    const backends = yield* ConnectorBackends;
    const calls = yield* ConnectorCalls;
    const asking = yield* ConnectorAsking;
    const notices = yield* ConnectorNotices;
    const catalog = options.catalog ?? defaultCatalog;
    const platform = options.platform ?? process.platform;
    const listing = makeToolListing({ backends, vault });
    const provided = Effect.provideService(SqlClient.SqlClient, sql);
    const operations: OperationDependencies = { calls, catalog, listing, platform, sql, vault };
    const cardDependencies: CardDependencies = { catalog, listing, platform, sql, vault };
    const callDependencies: CallDependencies = { asking, calls, catalog, changes, listing, notices, sql, vault };

    const card = Effect.fnUntraced(function* (connectorId: string) {
      const entry = entryOf(catalog, connectorId);
      if (entry === null) return yield* notFound("Outlore offers no such connector.");
      return yield* cardOf(cardDependencies, entry);
    });

    /** Lists a connector's tools again; a failure warns the thread that starts the turn, when one is named. */
    const refreshFor = Effect.fnUntraced(function* (entry: CatalogEntry, threadId: string | null) {
      const result = yield* listing.refresh(entry);
      if (result._tag === "Listed") return;
      if (threadId !== null) yield* recordFailure(callDependencies, entry, threadId, result.failure);
      else if (failureOutcomeOf(result.failure).isRefused) yield* markRefused(callDependencies, entry);
    });

    const beginTurn = Effect.fnUntraced(function* (threadId: string) {
      const subject = yield* readSubject(threadId).pipe(provided);
      if (subject === null) return [];
      for (const record of yield* readConnectorRecords.pipe(provided)) {
        const entry = entryOf(catalog, record.id);
        if (entry === null) continue;
        if (isUsableBy(yield* readStanding(callDependencies, entry, record), subject))
          yield* refreshFor(entry, threadId);
      }
      const names = (yield* readOfferedTools(callDependencies, threadId)).map((tool) => tool.listedName);
      yield* calls.takeSnapshot(threadId, names);
      return names;
    }, Effect.orDie);

    const finishRemoval = Effect.fnUntraced(function* (connectorId: string) {
      yield* sql.withTransaction(deleteConnector(connectorId).pipe(provided));
      yield* listing.forget(connectorId);
      yield* changes.publish;
    });

    const eraseSecrets = (connectorId: string) =>
      vault.removeAllOf(connectorId).pipe(
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

    const built: ConnectorsBuilt = {
      beginTurn,
      card,
      cards: Effect.forEach(catalog, (entry) => cardOf(cardDependencies, entry)),
      choicesAt: (level) => choiceCardsOf(cardDependencies, level),
      chooseApps: (request) => chooseApps(operations, request),
      clearNeeds: (connectorId) => writeNeeds(connectorId, null).pipe(provided, Effect.andThen(changes.publish)),
      eraseSecrets,
      finishRemoval,
      gateway: {
        beginTurn,
        call: makeCall(callDependencies),
        endTurn: (threadId: string) => calls.dropSnapshot(threadId),
        listingFor: (threadId: string) =>
          listOfferedTools(callDependencies, threadId).pipe(
            Effect.map((tools) => tools.map(toolOf)),
            Effect.orDie,
          ),
      },
      install: (request) => installConnector(operations, request),
      refresh: (connectorId) =>
        Effect.gen(function* () {
          const entry = entryOf(catalog, connectorId);
          const record = entry === null ? null : yield* readConnectorRecord(connectorId).pipe(provided);
          if (entry !== null && record !== null) yield* refreshFor(entry, null);
        }),
      requestApplePermission: Effect.fnUntraced(function* (connectorId: string) {
        const entry = entryOf(catalog, connectorId);
        if (entry === null) return yield* notFound("Outlore offers no such connector.");
        if (entry.platform === "macOS" && platform !== "darwin")
          return yield* invalid("Apple apps run on a Mac only, so there is no permission to ask for here.");
        const record = yield* readConnectorRecord(connectorId).pipe(provided);
        if (record === null) return yield* invalid("That connector is not installed on this computer.");
        const apps = record.apps ?? defaultAppsOf(entry);
        // The probe runs on the backend the connector's calls run on, so macOS is asked by the same child process.
        const backend = yield* listing.backendOf(entry);
        return yield* applePermissionReportOf(entry, apps, backend);
      }),
      resumeRemovals: Effect.gen(function* () {
        for (const record of yield* readConnectorRecords.pipe(provided)) {
          if (!record.isRemoving) continue;
          yield* eraseSecrets(record.id).pipe(Effect.andThen(finishRemoval(record.id)));
        }
      }).pipe(Effect.ignore),
      setSwitch: (request) => setConnectorSwitch(operations, request),
      setTool: (request) => setConnectorTool(operations, request),
      startRemoval: (connectorId) => startRemoval(operations, connectorId),
      stopRevokedCalls: calls.stopRevoked.pipe(Effect.asVoid),
    };
    return built;
  });

/**
 * The service's connectors over the stored choices: the owner's side (`Connectors`) and the threads' side
 * (`ConnectorGateway`). It needs the Vault, the backends, the registry of calls, and what `work/` supplies (asking the
 * owner and warning a thread).
 */
export const connectorServicesLayer = (options: ConnectorsOptions = {}) =>
  Layer.effectContext(
    Effect.gen(function* () {
      const made = yield* make(options);
      // A removal a crash left halfway resumes at its second step, as the service starts.
      yield* made.resumeRemovals;
      return Context.make(Connectors, made).pipe(Context.add(ConnectorGateway, made.gateway));
    }),
  );

import type {
  ApplePermissionReport,
  ConnectorCard,
  ConnectorChoiceCard,
  ConnectorChoiceLevel,
} from "@outlore/contracts";
import { Context, Effect, Layer, Semaphore } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { Changes, notFound, type ServiceFailure } from "../core/index.ts";
import { makeApplePermissions } from "./applePermissions.ts";
import { ConnectorAsking, ConnectorNotices } from "./asking.ts";
import { isUsableBy } from "./availability.ts";
import { ConnectorBackends } from "./backend.ts";
import { ConnectorCalls } from "./calls.ts";
import { type CatalogEntry, entryOf } from "./catalog.ts";
import { defaultCatalog } from "./catalogEntries.ts";
import { type AuthFlowDependencies, requestAppleConnectorPermission, signInConnector } from "./connectorAuth.ts";
import { type CallDependencies, listOfferedTools, makeCall, markRefused, recordFailure } from "./connectorCall.ts";
import { type CardDependencies, type PanelTool, readCard, readPanelTools } from "./connectorCards.ts";
import { readChoiceCards } from "./connectorChoiceCards.ts";
import { writeNeedsAndPublish } from "./connectorNeeds.ts";
import {
  chooseApps,
  installConnector,
  type OperationDependencies,
  setConnectorSwitch,
  setConnectorTool,
  startRemoval,
} from "./connectorOperations.ts";
import {
  eraseConnectorSecrets,
  finishConnectorRemoval,
  type RemovalDependencies,
  resumeConnectorRemovals,
} from "./connectorRemoval.ts";
import { type OfferedConnectorTool, readOfferedTools, readStanding, type StateDependencies } from "./connectorState.ts";
import { readConnectorRecord, readConnectorRecords, readSubject } from "./connectorStore.ts";
import { ConnectorGateway, type ConnectorTool } from "./gateway.ts";
import { type BrowserOpener, defaultOpenBrowser } from "./oauth/index.ts";
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
    /** Chooses which apps are on. */
    readonly chooseApps: (
      request: Parameters<typeof chooseApps>[1],
    ) => Effect.Effect<void, ServiceFailure | SqlError.SqlError>;
    /** Clears Needs connecting, as the owner gives the connector a new secret; the Vault's requests call it. */
    readonly clearNeeds: (connectorId: string) => Effect.Effect<void, SqlError.SqlError>;
    /** The last step of a removal: the connector's rows and permissions, and what is kept of its server. */
    readonly finishRemoval: (connectorId: string) => Effect.Effect<void, SqlError.SqlError>;
    /** Installs a connector; then `refresh` lists its tools. */
    readonly install: (
      request: Parameters<typeof installConnector>[1],
    ) => Effect.Effect<void, ServiceFailure | SqlError.SqlError>;
    /** Asks macOS, through the connector's own child process, whether each chosen app allows Automation. */
    readonly requestApplePermission: (
      connectorId: string,
    ) => Effect.Effect<ApplePermissionReport, ServiceFailure | SqlError.SqlError>;
    /** Asks a connector's server for its tools again, marking it Needs connecting when it refuses. */
    readonly refresh: (connectorId: string) => Effect.Effect<void, SqlError.SqlError>;
    /** The second step of a removal: the connector's secrets in the Vault, which fails when the Vault cannot answer. */
    readonly eraseSecrets: (connectorId: string) => Effect.Effect<void, ServiceFailure>;
    /** Resumes every removal a crash left halfway, at its second step; one that cannot finish stays Removing. */
    readonly resumeRemovals: Effect.Effect<void>;
    /** Sets a switch at one level. */
    readonly setSwitch: (
      request: Parameters<typeof setConnectorSwitch>[1],
    ) => Effect.Effect<void, ServiceFailure | SqlError.SqlError>;
    /** Switches a tool on or off. */
    readonly setTool: (
      request: Parameters<typeof setConnectorTool>[1],
    ) => Effect.Effect<void, ServiceFailure | SqlError.SqlError>;
    /** Runs the generic MCP OAuth 2.1 browser sign-in flow for an installed OAuth connector. */
    readonly signIn: (connectorId: string) => Effect.Effect<ConnectorCard, ServiceFailure | SqlError.SqlError>;
    /** The first step of a removal. */
    readonly startRemoval: (connectorId: string) => Effect.Effect<void, ServiceFailure | SqlError.SqlError>;
    /** Stops the calls underway whose tool a committed change took from their thread. */
    readonly stopRevokedCalls: Effect.Effect<void>;
    /** Last-listed tools of usable connectors, including switched-off tools, for a thread's panel. */
    readonly panelTools: (threadId: string) => Effect.Effect<ReadonlyArray<PanelTool>, SqlError.SqlError>;
  }
>()("outlore/connectors/Connectors") {}

/** What the connectors are built over: the catalog the Charter offers, the host's platform, and optional browser opener. */
export type ConnectorsOptions = {
  readonly catalog?: ReadonlyArray<CatalogEntry>;
  readonly openBrowser?: BrowserOpener;
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

const ownerOperationsOf = (operations: OperationDependencies) => ({
  chooseApps: (request: Parameters<typeof chooseApps>[1]) => chooseApps(operations, request),
  install: (request: Parameters<typeof installConnector>[1]) => installConnector(operations, request),
  setSwitch: (request: Parameters<typeof setConnectorSwitch>[1]) => setConnectorSwitch(operations, request),
  setTool: (request: Parameters<typeof setConnectorTool>[1]) => setConnectorTool(operations, request),
  startRemoval: (connectorId: string) => startRemoval(operations, connectorId),
});

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
    const permissions = makeApplePermissions();
    const permissionChecks = yield* Semaphore.make(1);
    const signInLocks = new Map<string, Semaphore.Semaphore>();
    const signInLockOf = (connectorId: string) => {
      const existing = signInLocks.get(connectorId);
      if (existing !== undefined) return existing;
      const created = Semaphore.makeUnsafe(1);
      signInLocks.set(connectorId, created);
      return created;
    };

    const state: StateDependencies = { catalog, listing, permissions, sql, vault };
    const operations: OperationDependencies = { ...state, calls, platform };
    const cardDependencies: CardDependencies = { ...state, platform };
    const callDependencies: CallDependencies = { ...state, asking, calls, changes, notices };
    const authDependencies: AuthFlowDependencies = {
      ...cardDependencies,
      callDependencies,
      changes,
      openBrowser: options.openBrowser ?? defaultOpenBrowser,
    };
    const removalDependencies: RemovalDependencies = { changes, listing, permissions, sql, vault };

    const card = Effect.fnUntraced(function* (connectorId: string) {
      const entry = entryOf(catalog, connectorId);
      if (entry === null) return yield* notFound("Outlore offers no such connector.");
      return yield* readCard(cardDependencies, entry);
    });

    /** Lists a connector's tools again; a failure warns the thread that starts the turn, when one is named. */
    const refreshFor = Effect.fnUntraced(function* (entry: CatalogEntry, threadId: string | null) {
      const result = yield* listing.refresh(entry);
      if (result._tag === "Listed") return;
      if (threadId !== null) yield* recordFailure(callDependencies, entry, threadId, result.failure);
      else if (failureOutcomeOf(result.failure).isRefused) yield* markRefused(callDependencies, entry);
    });

    const beginTurn = Effect.fnUntraced(function* (threadId: string, runKey: string = threadId) {
      const subject = yield* readSubject(threadId).pipe(provided);
      if (subject === null) return [];
      for (const record of yield* readConnectorRecords.pipe(provided)) {
        const entry = entryOf(catalog, record.id);
        if (entry === null) continue;
        if (isUsableBy(yield* readStanding(callDependencies, entry, record), subject))
          yield* refreshFor(entry, threadId);
      }
      const names = (yield* readOfferedTools(callDependencies, threadId)).map((tool) => tool.listedName);
      yield* calls.takeSnapshot(threadId, names, runKey);
      return names;
    }, Effect.orDie);

    const built: ConnectorsBuilt = {
      ...ownerOperationsOf(operations),
      beginTurn,
      card,
      cards: Effect.forEach(catalog, (entry) => readCard(cardDependencies, entry)),
      choicesAt: (level) => readChoiceCards(cardDependencies, level),
      clearNeeds: (connectorId) => writeNeedsAndPublish({ changes, sql }, connectorId, null),
      eraseSecrets: (connectorId) => eraseConnectorSecrets(removalDependencies, connectorId),
      finishRemoval: (connectorId) => finishConnectorRemoval(removalDependencies, connectorId),
      gateway: {
        beginTurn,
        call: makeCall(callDependencies),
        endTurn: (runKey: string) => calls.dropSnapshot(runKey),
        listingFor: (threadId: string) =>
          listOfferedTools(callDependencies, threadId).pipe(
            Effect.map((tools) => tools.map(toolOf)),
            Effect.orDie,
          ),
      },
      panelTools: (threadId) => readPanelTools(cardDependencies, threadId),
      refresh: (connectorId) =>
        Effect.gen(function* () {
          const entry = entryOf(catalog, connectorId);
          const record = entry === null ? null : yield* readConnectorRecord(connectorId).pipe(provided);
          if (entry !== null && record !== null) yield* refreshFor(entry, null);
        }),
      requestApplePermission: (connectorId) =>
        permissionChecks.withPermit(requestAppleConnectorPermission(authDependencies, connectorId)),
      resumeRemovals: resumeConnectorRemovals(removalDependencies),
      signIn: (connectorId) => signInLockOf(connectorId).withPermit(signInConnector(authDependencies, connectorId)),
      stopRevokedCalls: calls.stopRevoked.pipe(Effect.asVoid),
    };
    return built;
  });

/** The service's connectors over the stored choices: the owner's side (`Connectors`) and the threads' side (`ConnectorGateway`). */
export const connectorServicesLayer = (options: ConnectorsOptions = {}) =>
  Layer.effectContext(
    Effect.gen(function* () {
      const made = yield* make(options);
      // A removal a crash left halfway resumes at its second step, as the service starts.
      yield* made.resumeRemovals;
      return Context.make(Connectors, made).pipe(Context.add(ConnectorGateway, made.gateway));
    }),
  );

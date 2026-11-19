import { dirname, join } from "node:path";
import type { Request, RequestSource } from "@outlore/contracts";
import { Effect, Layer, Match, Semaphore } from "effect";
import type { SqlError } from "effect/sql";
import {
  type CatalogEntry,
  type ConnectorBackends,
  type ConnectorGateway,
  Connectors,
  connectorServicesLayer,
  connectorsLayer,
  unbuiltBackendsLayer,
  type VaultPort,
} from "./connectors/index.ts";
import {
  addBrowsableRoot,
  browseFolders,
  Changes,
  changesLayer,
  createFolder,
  endpointsLayer,
  type Harness,
  HomeFolder,
  mergedSettings,
  noPriceSourceLayer,
  type PriceSource,
  PriceTable,
  priceTableLayer,
  readSettings,
  readStartChoices,
  removeBrowsableRoot,
  ServiceFailure,
  searchFolders,
  seedBrowsableRoots,
  sessionsLayer,
  storeLayer,
  vaultFolderOf,
} from "./core/index.ts";
import { fakeHarnessToolsLayer, type HarnessTools } from "./harness/index.ts";
import { listOpenQuestions, removePermission, widenPermission } from "./policy/index.ts";
import {
  cloudflareApiFor,
  computerNameOf,
  type DeployResult,
  defaultRelayOrigin,
  deployRelayToCloudflare,
  makeHostControl,
  RemoteConfig,
  RemoteState,
  remoteHostLayer,
  remoteStateLayer,
} from "./remote/index.ts";
import { Service } from "./serviceTag.ts";
import { HostUpdate, type HostUpdater, hostUpdateLayer, noHostUpdaterLayer } from "./update/index.ts";
import { type KeyCustody, Vault, vaultLayer } from "./vault/index.ts";
import {
  AccountsRoot,
  Approvals,
  AttachmentsRoot,
  accountsHandlers,
  addCredit,
  admitRequestSource,
  approvalsLayer,
  autoArchiveLayer,
  budgetPeriodsLayer,
  Commands,
  changed,
  commandsLayer,
  connectorAskingLayer,
  connectorHandlers,
  connectorNoticesLayer,
  guildmasterReportsLayer,
  listMentionables,
  listSkills,
  listWorkspaceEntries,
  loreHandlers,
  messagesHandlers,
  planLimitsLayer,
  priceRefreshLayer,
  questsHandlers,
  type RequestServices,
  readAccountBudgets,
  readBudgetWindow,
  readPermissionsView,
  readUsage,
  realmHandlers,
  remoteHandlers,
  resolveChatter,
  ritualsHandlers,
  ritualsLayer,
  ScratchRoot,
  Suggestions,
  saveSettings,
  setAccountBudget,
  setMissionBudget,
  startupCleanupLayer,
  stopAtBudget,
  suggestionsLayer,
  switchAtBudget,
  Threads,
  threadsLayer,
  toolServerLayer,
  vaultHandlers,
  vaultPortLayer,
} from "./work/index.ts";

// Stored and wire names keep `intel` so existing data and agents still work: request tags (`"ListIntel"`, ...).

export { Service };

const storageFailure = (error: SqlError.SqlError) =>
  new ServiceFailure({ kind: "ExecutionFailure", message: `Storage failed: ${error.message}` });

const make = Effect.gen(function* () {
  const changes = yield* Changes;
  const remote = yield* RemoteState;
  const remoteConfig = yield* RemoteConfig;
  const threads = yield* Threads;
  const homeFolder = yield* HomeFolder;
  const commands = yield* Commands;
  const approvals = yield* Approvals;
  const connectors = yield* Connectors;
  const vault = yield* Vault;
  const suggestions = yield* Suggestions;
  const prices = yield* PriceTable;
  const hostUpdate = yield* HostUpdate;
  /** Runs storage work as a command whose only follow-up is announcing the change. */
  const change = <A, E, R>(work: Effect.Effect<A, E, R>) => commands.run(Effect.map(work, (value) => changed(value)));
  const hostControl = makeHostControl({ change, config: remoteConfig, state: remote });
  const chatterDecisions = yield* Semaphore.make(1);

  const dependencies = { change, changes, commands, hostControl, threads };
  const context = yield* Effect.context<RequestServices>();

  /**
   * Answers one request. A paired device's folder requests reach only the browsable roots; the host's own window,
   * the default, reaches any folder (device-pairing, CHG-0253).
   */
  const handle = (
    request: Request,
    source: RequestSource = { isPairedDevice: false },
  ): Effect.Effect<unknown, ServiceFailure> =>
    Effect.gen(function* () {
      const { folderAccess, deviceLabel } = yield* admitRequestSource(source, request);
      // One handler per request tag; Match.valueTags fails to compile when a tag has none.
      const run: Effect.Effect<unknown, ServiceFailure | SqlError.SqlError, RequestServices> = Match.valueTags(
        request,
        {
          ...loreHandlers(dependencies),
          ...accountsHandlers(dependencies),
          ...remoteHandlers(dependencies),
          ...messagesHandlers(dependencies),
          ...questsHandlers(dependencies),
          ...ritualsHandlers(dependencies),
          ...connectorHandlers(commands, connectors),
          ...vaultHandlers(commands, vault, connectors),
          AddBrowsableRoot: (add) => change(addBrowsableRoot(add.path)),
          AddCredit: (given) =>
            commands.run(addCredit({ accountId: given.accountId, harness: given.harness }, given.amount)),
          AnswerChoices: (given) => approvals.answerChoices(given.questionId, given.answers, deviceLabel),
          AnswerQuestion: (given) => approvals.answer(given.questionId, given.answer, given.message, deviceLabel),
          AnswerSuggestion: (given) =>
            suggestions.answer(given.suggestionId, given.answer).pipe(
              Effect.tap(({ followUps }) => commands.apply(followUps)),
              Effect.map(({ value }) => value),
            ),
          BrowseFolders: (browse) => browseFolders(browse.path, browse.shouldIncludeHidden, folderAccess),
          ChangeSettings: (given) => saveSettings((saved) => mergedSettings(saved, given.change)),
          CreateFolder: (create) => createFolder(create.parent, create.name, folderAccess),
          ...realmHandlers(commands),
          ListMentionables: () => listMentionables,
          ListOpenQuestions: () => listOpenQuestions,
          ListSkills: (given) => listSkills(given.workspacePath),
          ListWorkspaceEntries: (given) => listWorkspaceEntries(given.workspacePath, given.query),
          ReadAccountBudgets: () => readAccountBudgets,
          ReadBudget: (read) => readBudgetWindow(read.missionId),
          ReadHostUpdate: () => hostUpdate.read,
          ReadPermissions: (read) => readPermissionsView(read.missionId),
          ReadPriceStatus: () => prices.status,
          ReadSettings: () => readSettings,
          ReadStartChoices: () => readStartChoices,
          ReadUsage: (read) => readUsage(read.period, read.filters),
          RefreshPrices: () =>
            prices.refresh.pipe(
              Effect.catchTag("PriceReadFailed", (failure) =>
                Effect.fail(new ServiceFailure({ kind: "ExecutionFailure", message: failure.reason })),
              ),
            ),
          RemoveBrowsableRoot: (remove) => change(removeBrowsableRoot(remove.path)),
          RemovePermission: (remove) => change(removePermission(remove.permissionId)),
          ResolveChatter: (given) => resolveChatter(given.id, given.choice).pipe(chatterDecisions.withPermit),
          SearchFolders: (search) => searchFolders(search.query, folderAccess, homeFolder),
          SetAccountBudget: (given) =>
            commands.run(
              setAccountBudget(
                { accountId: given.accountId, harness: given.harness },
                given.limits,
                given.period,
                given.since,
              ),
            ),
          SetMissionBudget: (given) => commands.run(setMissionBudget(given.missionId, given.limits)),
          StopAtBudget: (given) => commands.run(stopAtBudget(given.stopId)),
          SwitchAtBudget: (given) => commands.run(switchAtBudget(given.stopId)),
          UpdateHost: () => hostUpdate.arm,
          UpdateSettings: (update) => saveSettings(() => update.settings),
          WidenPermission: (widen) => change(widenPermission(widen.permissionId)),
        },
      );
      return yield* run;
    }).pipe(Effect.provideContext(context), Effect.catchTag("SqlError", storageFailure));

  return { handle };
});

/** Where the service keeps its data and how it reaches the harnesses. */
export interface ServiceOptions {
  /** Where provider accounts added in Outlore keep their folders; beside the database when left out. */
  readonly accountsRoot?: string;
  /** Where attached files are kept; beside the database when left out (message-attachments). */
  readonly attachmentsRoot?: string;
  /** The computer's name, offered as the host's name until the owner chooses one; the machine's own when left out. */
  readonly computerName?: string;
  /** The servers of the connectors; none is reachable when left out, until the backends are built (connectors blueprint, Order 4). */
  readonly connectorBackends?: Layer.Layer<ConnectorBackends>;
  /** The catalog of connectors the Charter offers; Composio and Apple apps when left out. */
  readonly connectorCatalog?: ReadonlyArray<CatalogEntry>;
  /**
   * The connector gateway, replacing the service's own over the stored connectors: a stand-in for a test of what stands
   * on the gateway, such as Code Mode (CHG-0441). Left out, threads use the connectors the owner installed.
   */
  readonly connectorGateway?: Layer.Layer<ConnectorGateway>;
  /** The platform the host runs on, which Apple apps needs to be macOS; the process's own when left out. */
  readonly connectorPlatform?: NodeJS.Platform;
  /** The Vault, which the connectors read secrets from; the service's own, adapted to the gateway's port, when left out. */
  readonly connectorVault?: Layer.Layer<VaultPort>;
  /** Deploys the relay to the Cloudflare account a token reaches (device-pairing, own relay); the real deployment when left out. */
  readonly deployOwnRelay?: (token: string) => Promise<DeployResult>;
  readonly filename: string;
  readonly harness: Layer.Layer<Harness>;
  /** The harnesses' own tools for sign-ins and models; every harness signed in, for checks, when left out. */
  readonly harnessTools?: Layer.Layer<HarnessTools>;
  /** The owner's home folder, the first browsable root (workspace-attachment). */
  readonly homeFolder: string;
  /** The updater of the app this host runs in, for updating the host from a paired device; none when left out. */
  readonly hostUpdater?: Layer.Layer<HostUpdater>;
  /** The key holders the Vault tries, in order; the platform's own and the key file when left out (ADR 0022). */
  readonly keyCustodies?: ReadonlyArray<KeyCustody>;
  /** The Worker's name on the owner's Cloudflare account; "outlore-relay" when left out. */
  readonly ownRelayWorkerName?: string;
  /** Where the model price table is read from; none, so the snapshot alone, when left out (decision record 0014). */
  readonly priceSource?: Layer.Layer<PriceSource>;
  /** The relay a new pairing code names; the shared relay of decision record 0016 when left out. */
  readonly relayOrigin?: string;
  /** The release this host runs, told to paired devices; "development" when left out. */
  readonly release?: string;
  /** The folder holding each mission's scratch folder. */
  readonly scratchRoot: string;
}

/**
 * The whole local service over one SQLite file. Approvals and suggestions come before Threads, which
 * withdraws them; the command runner comes after Threads, which it wakes, and the tool server after the
 * runner, which it calls; Threads and the tool server meet at the endpoints.
 */
export const serviceLayer = (options: ServiceOptions) => {
  const attachmentsRoot = options.attachmentsRoot ?? join(dirname(options.filename), "attachments");
  // The Vault, made and probed at start; it needs the harness adapters' denial reports (ADR 0022). The connectors'
  // port over it is built from this one instance, so a stand-in given as `connectorVault` replaces only the port.
  const vault = vaultLayer(vaultFolderOf(dirname(options.filename)), options.keyCustodies).pipe(
    Layer.provide(options.harness),
  );
  const vaultFoundation =
    options.connectorVault === undefined
      ? // One build of the Vault feeds both its own service and the gateway's port.
        vaultPortLayer.pipe(Layer.provideMerge(vault))
      : Layer.mergeAll(vault, options.connectorVault);
  const foundation = Layer.mergeAll(
    changesLayer,
    endpointsLayer,
    connectorsLayer,
    vaultFoundation,
    options.connectorBackends ?? unbuiltBackendsLayer,
    options.harness,
    options.harnessTools ?? fakeHarnessToolsLayer(),
    Layer.succeed(ScratchRoot, options.scratchRoot),
    Layer.succeed(HomeFolder, options.homeFolder),
    Layer.succeed(AccountsRoot, options.accountsRoot ?? join(dirname(options.filename), "accounts")),
    Layer.succeed(AttachmentsRoot, attachmentsRoot),
  ).pipe(
    Layer.provideMerge(Layer.effectDiscard(seedBrowsableRoots(options.homeFolder))),
    // The root is handed in here: layers stacked beneath the one that provides it never see it.
    Layer.provideMerge(startupCleanupLayer(attachmentsRoot, options.scratchRoot)),
    Layer.provideMerge(priceTableLayer.pipe(Layer.provide(options.priceSource ?? noPriceSourceLayer))),
    Layer.provideMerge(storeLayer(options.filename)),
  );
  // The connectors come after the approvals, which they ask through, and before the threads, whose turns take each
  // thread's snapshot of its connector tools from them.
  const connectorServices = connectorServicesLayer({
    ...(options.connectorCatalog === undefined ? {} : { catalog: options.connectorCatalog }),
    ...(options.connectorPlatform === undefined ? {} : { platform: options.connectorPlatform }),
  }).pipe(Layer.provide(Layer.mergeAll(connectorAskingLayer, connectorNoticesLayer)));
  const gateway =
    options.connectorGateway === undefined
      ? connectorServices
      : Layer.mergeAll(connectorServices, options.connectorGateway);
  const running = threadsLayer.pipe(
    Layer.provideMerge(gateway),
    Layer.provideMerge(Layer.mergeAll(approvalsLayer, suggestionsLayer)),
    Layer.provideMerge(foundation),
  );
  const remoteConfigLayer = Layer.succeed(RemoteConfig, {
    computerName: options.computerName ?? computerNameOf(),
    deployOwnRelay:
      options.deployOwnRelay ??
      ((token) =>
        deployRelayToCloudflare({
          api: cloudflareApiFor(token),
          token,
          ...(options.ownRelayWorkerName === undefined ? {} : { workerName: options.ownRelayWorkerName }),
        })),
    relayOrigin: options.relayOrigin ?? defaultRelayOrigin,
    release: options.release ?? "development",
  });
  const core = Layer.effect(Service, make).pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        remoteConfigLayer,
        remoteStateLayer,
        hostUpdateLayer.pipe(
          Layer.provide(options.hostUpdater ?? noHostUpdaterLayer()),
          Layer.provide(remoteConfigLayer),
        ),
        autoArchiveLayer,
        budgetPeriodsLayer,
        guildmasterReportsLayer,
        planLimitsLayer,
        priceRefreshLayer,
        ritualsLayer,
        sessionsLayer,
        toolServerLayer,
      ),
    ),
    Layer.provideMerge(commandsLayer),
    Layer.provideMerge(running),
  );
  // The host runtime serves paired devices through the service, so it comes after it.
  return remoteHostLayer.pipe(Layer.provideMerge(core));
};

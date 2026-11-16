import { dirname, join } from "node:path";
import type { Request, RequestSource } from "@outlore/contracts";
import { Effect, Layer, Match, Semaphore } from "effect";
import type { SqlError } from "effect/sql";
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
import { addCredit, readAccountBudgets, setAccountBudget } from "./work/accountBudgets.ts";
import { accountsHandlers } from "./work/accountsHandlers.ts";
import { Approvals, approvalsLayer } from "./work/approvals.ts";
import { AttachmentsRoot, sweepDrafts } from "./work/attachments.ts";
import { budgetPeriodsLayer } from "./work/budgetPeriods.ts";
import { saveSettings } from "./work/budgetSettings.ts";
import { setMissionBudget, stopAtBudget, switchAtBudget } from "./work/budgets.ts";
import { readBudgetWindow } from "./work/budgetViews.ts";
import { resolveChatter } from "./work/chatter.ts";
import { Commands, changed, commandsLayer } from "./work/commands.ts";
import { autoArchiveLayer } from "./work/ending.ts";
import { guildmasterReportsLayer } from "./work/guildmasterReports.ts";
import { loreHandlers } from "./work/loreHandlers.ts";
import { toolServerLayer } from "./work/mcp.ts";
import { listMentionables } from "./work/mentions.ts";
import { messagesHandlers } from "./work/messagesHandlers.ts";
import { readPermissionsView } from "./work/permissionViews.ts";
import { planLimitsLayer } from "./work/planLimits.ts";
import { priceRefreshLayer } from "./work/priceRefresh.ts";
import { questsHandlers } from "./work/questsHandlers.ts";
import { realmHandlers } from "./work/realmHandlers.ts";
import { remoteHandlers } from "./work/remoteHandlers.ts";
import { admitRequestSource } from "./work/requestAuthority.ts";
import type { RequestServices } from "./work/requestContext.ts";
import { ritualsLayer } from "./work/rituals.ts";
import { ritualsHandlers } from "./work/ritualsHandlers.ts";
import { listSkills } from "./work/skills.ts";
import { Suggestions, suggestionsLayer } from "./work/suggestions.ts";
import { AccountsRoot, Threads, threadsLayer } from "./work/threads.ts";
import { readUsage } from "./work/usageReport.ts";
import { listWorkspaceEntries } from "./work/workspaceEntries.ts";
import { ScratchRoot } from "./work/workspaces.ts";

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
  const suggestions = yield* Suggestions;
  const prices = yield* PriceTable;
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
  /** Deploys the relay to the Cloudflare account a token reaches (device-pairing, own relay); the real deployment when left out. */
  readonly deployOwnRelay?: (token: string) => Promise<DeployResult>;
  readonly filename: string;
  readonly harness: Layer.Layer<Harness>;
  /** The harnesses' own tools for sign-ins and models; every harness signed in, for checks, when left out. */
  readonly harnessTools?: Layer.Layer<HarnessTools>;
  /** The owner's home folder, the first browsable root (workspace-attachment). */
  readonly homeFolder: string;
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
  const foundation = Layer.mergeAll(
    changesLayer,
    endpointsLayer,
    options.harness,
    options.harnessTools ?? fakeHarnessToolsLayer(),
    Layer.succeed(ScratchRoot, options.scratchRoot),
    Layer.succeed(HomeFolder, options.homeFolder),
    Layer.succeed(AccountsRoot, options.accountsRoot ?? join(dirname(options.filename), "accounts")),
    Layer.succeed(AttachmentsRoot, attachmentsRoot),
  ).pipe(
    Layer.provideMerge(Layer.effectDiscard(seedBrowsableRoots(options.homeFolder))),
    // The root is handed in here: layers stacked beneath the one that provides it never see it.
    Layer.provideMerge(Layer.effectDiscard(Effect.provideService(sweepDrafts, AttachmentsRoot, attachmentsRoot))),
    Layer.provideMerge(priceTableLayer.pipe(Layer.provide(options.priceSource ?? noPriceSourceLayer))),
    Layer.provideMerge(storeLayer(options.filename)),
  );
  const running = threadsLayer.pipe(
    Layer.provideMerge(Layer.mergeAll(approvalsLayer, suggestionsLayer)),
    Layer.provideMerge(foundation),
  );
  const core = Layer.effect(Service, make).pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        Layer.succeed(RemoteConfig, {
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
        }),
        remoteStateLayer,
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

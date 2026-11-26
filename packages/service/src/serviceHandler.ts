import type { Request, RequestSource, RequestTag, ResultOf } from "@outlore/contracts";
import { Effect, Match, Semaphore } from "effect";
import type { SqlError } from "effect/sql";
import { Connectors } from "./connectors/index.ts";
import {
  Changes,
  changeCompanionPreset,
  HomeFolder,
  mergedSettings,
  PriceTable,
  readSettings,
  readStartChoices,
  ServiceFailure,
  type SettingWriter,
} from "./core/index.ts";
import { makeHostControl, RemoteConfig, RemoteState } from "./remote/index.ts";
import { HostUpdate } from "./update/index.ts";
import { Vault } from "./vault/index.ts";
import {
  Approvals,
  accountsHandlers,
  admitRequestSource,
  approvalsHandlers,
  budgetsHandlers,
  Commands,
  changed,
  connectorHandlers,
  hostUpdateHandlers,
  loreHandlers,
  messagesHandlers,
  type OwnerHandlers,
  PhoneLink,
  phoneHandlers,
  questsHandlers,
  type RequestServices,
  realmHandlers,
  remoteHandlers,
  ritualsHandlers,
  Suggestions,
  saveSettings,
  type TerminalScope,
  Terminals,
  Threads,
  terminalHandlers,
  vaultHandlers,
  workspaceHandlers,
} from "./work/index.ts";

// Stored and wire names keep `intel` so existing data and agents still work: request tags (`"ListIntel"`, ...).

const storageFailure = (error: SqlError.SqlError) =>
  new ServiceFailure({ kind: "ExecutionFailure", message: `Storage failed: ${error.message}` });

/** Builds the live `Service` request dispatcher over the service's acquired dependencies. */
export const makeService = Effect.gen(function* () {
  const changes = yield* Changes;
  const remote = yield* RemoteState;
  const remoteConfig = yield* RemoteConfig;
  const threads = yield* Threads;
  const homeFolder = yield* HomeFolder;
  /** The host's conversation shells (conversation-terminal, ADR 0020), from the layer that ends them. */
  const terminals = yield* Terminals;
  const commands = yield* Commands;
  const approvals = yield* Approvals;
  const connectors = yield* Connectors;
  const phoneLink = yield* PhoneLink;
  const vault = yield* Vault;
  const suggestions = yield* Suggestions;
  const prices = yield* PriceTable;
  const hostUpdate = yield* HostUpdate;
  /** Runs storage work as a command whose only follow-up is announcing the change. */
  const change = <Value, Failure, Requirements>(work: Effect.Effect<Value, Failure, Requirements>) =>
    commands.run(Effect.map(work, (value) => changed(value)));
  const hostControl = makeHostControl({ change, config: remoteConfig, state: remote });
  const chatterDecisions = yield* Semaphore.make(1);

  const dependencies = { change, changes, commands, hostControl, threads };
  const context = yield* Effect.context<RequestServices>();

  /** Answers one request, scoping folder and terminal access according to whether it came from a paired device (device-pairing, CHG-0253). */
  const answer = (request: Request, source: RequestSource): Effect.Effect<ResultOf<RequestTag>, ServiceFailure> =>
    Effect.gen(function* () {
      const { folderAccess, deviceLabel } = yield* admitRequestSource(source, request);
      // A paired device writes settings as the owner, the host's own window as the owner at the host (settingAuthority.ts).
      const settingWriter: SettingWriter = source.isPairedDevice ? "Owner" : "HostOwner";
      const terminalScope: TerminalScope = source.isPairedDevice ? "remote" : "host";
      const settingsHandlers = {
        ChangeCompanionPreset: ({ edit }) => change(changeCompanionPreset(edit)),
        ChangeSettings: (given) => saveSettings(settingWriter, (saved) => mergedSettings(saved, given.change)),
        ReadSettings: () => readSettings,
        ReadStartChoices: () => readStartChoices,
        UpdateSettings: (update) => saveSettings(settingWriter, () => update.settings),
      } satisfies OwnerHandlers<
        "ChangeCompanionPreset" | "ChangeSettings" | "ReadSettings" | "ReadStartChoices" | "UpdateSettings"
      >;
      // One handler per request tag, each answering its result schema; the table fails to compile when a tag has none or one answers something its schema cannot encode.
      const table = {
        ...loreHandlers(dependencies),
        ...accountsHandlers(dependencies, terminals, terminalScope),
        ...remoteHandlers(dependencies),
        ...messagesHandlers(dependencies),
        ...questsHandlers(dependencies, connectors),
        ...ritualsHandlers(dependencies),
        ...terminalHandlers(terminals, terminalScope),
        ...connectorHandlers(commands, connectors),
        ...vaultHandlers(commands, vault, connectors),
        ...realmHandlers(commands, folderAccess),
        ...approvalsHandlers(dependencies, approvals, suggestions, chatterDecisions, deviceLabel),
        ...budgetsHandlers(dependencies, prices),
        ...hostUpdateHandlers(hostUpdate),
        ...phoneHandlers(phoneLink, source),
        ...workspaceHandlers(dependencies, folderAccess, homeFolder),
        ...settingsHandlers,
      } satisfies OwnerHandlers<RequestTag>;
      return yield* Match.valueTags(request, table);
    }).pipe(Effect.provideContext(context), Effect.catchTag("SqlError", storageFailure));

  /** Answers one request with its own result: the type follows the request's tag, which the table above guarantees. */
  const handle = <RequestItem extends Request>(
    request: RequestItem,
    source: RequestSource = { isPairedDevice: false },
  ): Effect.Effect<ResultOf<RequestItem["_tag"]>, ServiceFailure> =>
    answer(request, source) as Effect.Effect<ResultOf<RequestItem["_tag"]>, ServiceFailure>;

  return { handle };
});

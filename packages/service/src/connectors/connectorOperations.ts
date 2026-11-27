import type { ConnectorSwitchLevel } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "../core/index.ts";
import type { ConnectorCalls } from "./calls.ts";
import { catalogToolOf, defaultAppsOf, entryOf, isRunnableOn, isToolName } from "./catalog.ts";
import { narrowSnapshotsToOffered, type StateDependencies } from "./connectorState.ts";
import {
  type ChoiceLevel,
  hasQuest,
  hasRealm,
  insertConnector,
  markRemoving,
  readConnectorRecord,
  writeApps,
  writeChoice,
  writeEnabled,
  writeToolSwitch,
} from "./connectorStore.ts";

// The owner's changes to connectors (connectors blueprint, Stored choices; Stopping at once).
// Each runs inside the caller's transaction, which is the command's; a change that can take a tool from a thread narrows the turn snapshots there, after its own write and before it commits, so a call that reads its snapshot afterwards finds the tool gone and a tool switched off and on again within a turn stays off.
// The calls underway are stopped once the command commits.

/** What the operations need. */
export type OperationDependencies = StateDependencies & {
  readonly calls: ConnectorCalls["Service"];
  readonly platform: NodeJS.Platform;
};

const provide = (dependencies: OperationDependencies) => Effect.provideService(SqlClient.SqlClient, dependencies.sql);

/** The installed, not-being-removed connector with this id, or the refusal the owner reads. */
const requireInstalled = Effect.fnUntraced(function* (dependencies: OperationDependencies, connectorId: string) {
  const entry = entryOf(dependencies.catalog, connectorId);
  const record = entry === null ? null : yield* readConnectorRecord(connectorId).pipe(provide(dependencies));
  if (entry === null || record === null) return yield* notFound("That connector is not installed.");
  if (record.isRemoving) return yield* invalid(`${entry.name} is being removed.`);
  return { entry, record };
});

/** Installs a connector: global, enabled everywhere, with its apps chosen when it has apps. */
export const installConnector = Effect.fnUntraced(function* (
  dependencies: OperationDependencies,
  request: {
    readonly apps?: ReadonlyArray<string>;
    readonly connectorId: string;
    readonly hasConfirmedNotice: boolean;
  },
) {
  const entry = entryOf(dependencies.catalog, request.connectorId);
  if (entry === null) return yield* notFound("Outlore offers no such connector.");
  if (!isRunnableOn(entry, dependencies.platform)) return yield* invalid(`${entry.name} needs a Mac.`);
  if ((yield* readConnectorRecord(entry.id).pipe(provide(dependencies))) !== null)
    return yield* invalid(`${entry.name} is already installed.`);
  if (entry.notice !== null && !request.hasConfirmedNotice)
    return yield* invalid(`Read and confirm the notice before installing ${entry.name}.`);
  const known = new Set(entry.apps.map((app) => app.id));
  if (entry.apps.length === 0 && request.apps !== undefined)
    return yield* invalid(`${entry.name} has no apps to choose.`);
  if (request.apps?.some((app) => !known.has(app)) === true) return yield* invalid("That app is not one of its apps.");
  const apps = entry.apps.length === 0 ? null : [...new Set(request.apps ?? defaultAppsOf(entry))];
  yield* insertConnector(entry.id, apps, yield* Clock.currentTimeMillis).pipe(provide(dependencies));
});

/** Sets a connector's switch at one level: On or Off, or Reset to Inherit; the global switch has no Inherit. */
export const setConnectorSwitch = Effect.fnUntraced(function* (
  dependencies: OperationDependencies,
  request: {
    readonly choice: "On" | "Off" | "Reset";
    readonly connectorId: string;
    readonly level: ConnectorSwitchLevel;
  },
) {
  yield* requireInstalled(dependencies, request.connectorId);
  const { choice, level } = request;
  if (level._tag === "Global") {
    if (choice === "Reset") return yield* invalid("The global switch is on or off; it has no Inherit.");
    yield* writeEnabled(request.connectorId, choice === "On").pipe(provide(dependencies));
  } else {
    if (level._tag === "Realm" && !(yield* hasRealm(level.realmId).pipe(provide(dependencies))))
      return yield* notFound("No such realm.");
    if (level._tag === "Quest" && !(yield* hasQuest(level.missionId).pipe(provide(dependencies))))
      return yield* notFound("No such quest.");
    const stored: ChoiceLevel =
      level._tag === "Realm"
        ? { _tag: "Realm", realmId: level.realmId }
        : level._tag === "Quest"
          ? { _tag: "Quest", missionId: level.missionId }
          : { _tag: "Borderlands" };
    yield* writeChoice(request.connectorId, stored, choice === "Reset" ? null : choice).pipe(provide(dependencies));
  }
  yield* narrowSnapshotsToOffered(dependencies);
});

/** Switches one tool of a connector on or off, for every thread. */
export const setConnectorTool = Effect.fnUntraced(function* (
  dependencies: OperationDependencies,
  request: { readonly connectorId: string; readonly isOn: boolean; readonly tool: string },
) {
  const { entry } = yield* requireInstalled(dependencies, request.connectorId);
  const isKnown =
    catalogToolOf(entry, request.tool) !== null ||
    dependencies.listing.cachedTools(entry.id).some((tool) => tool.name === request.tool);
  if (!isToolName(request.tool) || !isKnown) return yield* notFound(`${entry.name} has no tool of that name.`);
  yield* writeToolSwitch(entry.id, request.tool, request.isOn).pipe(provide(dependencies));
  yield* narrowSnapshotsToOffered(dependencies);
});

/** Chooses which apps are on; an app turned off takes its tools from every thread. */
export const chooseApps = Effect.fnUntraced(function* (
  dependencies: OperationDependencies,
  request: { readonly apps: ReadonlyArray<string>; readonly connectorId: string },
) {
  const { entry } = yield* requireInstalled(dependencies, request.connectorId);
  if (entry.apps.length === 0) return yield* invalid(`${entry.name} has no apps to choose.`);
  const known = new Set(entry.apps.map((app) => app.id));
  if (request.apps.some((app) => !known.has(app))) return yield* invalid("That app is not one of its apps.");
  yield* writeApps(entry.id, [...new Set(request.apps)]).pipe(provide(dependencies));
  yield* narrowSnapshotsToOffered(dependencies);
});

/** The first step of a removal: the connector is unusable at once, and its calls underway are stopped on commit. */
export const startRemoval = Effect.fnUntraced(function* (dependencies: OperationDependencies, connectorId: string) {
  const entry = entryOf(dependencies.catalog, connectorId);
  const record = entry === null ? null : yield* readConnectorRecord(connectorId).pipe(provide(dependencies));
  if (entry === null || record === null) return yield* notFound("That connector is not installed.");
  if (!record.isRemoving) yield* markRemoving(connectorId).pipe(provide(dependencies));
  yield* narrowSnapshotsToOffered(dependencies);
});

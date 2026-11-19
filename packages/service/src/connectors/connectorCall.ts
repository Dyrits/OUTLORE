import { Deferred, Effect } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { type Changes, type ToolAnswer, toolRefusal, toolText, unknownToolAnswer } from "../core/index.ts";
import type { ConnectorAsking, ConnectorNotices, ToolUse } from "./asking.ts";
import type { ConnectorCalls, Invocation } from "./calls.ts";
import { type CatalogEntry, catalogToolOf, entryOf, splitListedName } from "./catalog.ts";
import { cappedOf, failureSentenceOf, needsReasonOf, redactedOf, refusals, warningOf } from "./connectorErrors.ts";
import { type OfferedConnectorTool, readOfferedTools, type StateDependencies } from "./connectorState.ts";
import { readConnectorRecord, writeNeeds } from "./connectorStore.ts";
import { type CredentialedFailure, failureOutcomeOf } from "./toolListing.ts";

// The one door that runs a connector tool for a thread (connectors blueprint, Gateway, `call`): each step refuses with a
// plain sentence the thread reads.

/** What the call needs besides the state reads. */
export type CallDependencies = StateDependencies & {
  readonly asking: ConnectorAsking["Service"];
  readonly calls: ConnectorCalls["Service"];
  readonly changes: Changes["Service"];
  readonly notices: ConnectorNotices["Service"];
  readonly revokeApplePermission: (connectorId: string, app: string) => void;
};

const maxDetailCharacters = 4_000;

/** The arguments as the thread gave them, for the owner to read on request, cut when very long. */
const detailsOf = (args: unknown) => {
  const text = JSON.stringify(args, null, 2) ?? "No arguments.";
  return text.length <= maxDetailCharacters
    ? text
    : `${text.slice(0, maxDetailCharacters)}\n[Cut: ${text.length - maxDetailCharacters} more characters.]`;
};

/** The question's words, built from the catalog and never from a server's text. */
const questionOf = (entry: CatalogEntry, tool: string, args: unknown): ToolUse => {
  const named = catalogToolOf(entry, tool);
  return {
    connector: entry.id,
    details: detailsOf(args),
    summary:
      named === null
        ? `Use ${entry.name}: the tool "${tool}". Outlore does not know what it changes, so it asks.`
        : `Use ${entry.name}: ${named.summary}`,
    tool,
  };
};

/** The thread's snapshot of its tools, taken now when no turn has taken one yet. */
const snapshotOf = Effect.fnUntraced(function* (dependencies: CallDependencies, threadId: string) {
  const existing = dependencies.calls.snapshotOf(threadId);
  if (existing !== null) return existing;
  const offered = yield* readOfferedTools(dependencies, threadId);
  yield* dependencies.calls.takeSnapshot(
    threadId,
    offered.map((tool) => tool.listedName),
  );
  return dependencies.calls.snapshotOf(threadId) ?? new Set<string>();
});

/**
 * Whether the thread may make this call at this moment, or the refusal it reads: the tool is in the turn's snapshot (a
 * tool switched off and on again during the turn is not) and the stored choices still offer it.
 */
const refusalOf = Effect.fnUntraced(function* (dependencies: CallDependencies, threadId: string, listedName: string) {
  const snapshot = yield* snapshotOf(dependencies, threadId);
  if (!snapshot.has(listedName)) return toolRefusal(refusals.cancelled);
  const offered = yield* readOfferedTools(dependencies, threadId);
  return offered.some((tool) => tool.listedName === listedName) ? null : toolRefusal(refusals.cancelled);
});

/**
 * A server refused the connector's credentials: it is marked Needs connecting for everyone, and what it offered is taken
 * from every thread, those underway stopped.
 */
export const markRefused = Effect.fnUntraced(function* (dependencies: CallDependencies, entry: CatalogEntry) {
  const provided = Effect.provideService(SqlClient.SqlClient, dependencies.sql);
  const record = yield* readConnectorRecord(entry.id).pipe(provided);
  if (record !== null && record.needs === null) {
    yield* dependencies.sql
      .withTransaction(writeNeeds(entry.id, needsReasonOf(entry.name)).pipe(provided))
      .pipe(Effect.andThen(dependencies.changes.publish));
  }
  yield* dependencies.listing.forget(entry.id);
  yield* dependencies.calls.narrowSnapshots((id) =>
    readOfferedTools(dependencies, id).pipe(
      Effect.map((tools) => new Set(tools.map((tool) => tool.listedName))),
      Effect.orDie,
    ),
  );
  yield* dependencies.calls.stopRevoked;
});

/**
 * Records a failure that is not the thread's own: a refused sign-in marks the connector Needs connecting for everyone; a
 * failure that warns puts one line in the thread, and the turn goes on without the connector.
 */
export const recordFailure = Effect.fnUntraced(function* (
  dependencies: CallDependencies,
  entry: CatalogEntry,
  threadId: string,
  failure: CredentialedFailure,
  invocation: Invocation | null = null,
  app: string | null = null,
) {
  const { errorClass, isRefused } = failureOutcomeOf(failure);
  if (isRefused && app !== null) {
    dependencies.revokeApplePermission(entry.id, app);
    yield* narrowPermittedTools(dependencies, invocation?.id ?? null);
    yield* dependencies.changes.publish;
    const name = entry.apps.find((each) => each.id === app)?.name ?? entry.name;
    yield* dependencies.notices.warn(threadId, `${name} needs permission again, so this turn goes on without it.`);
    return toolRefusal(
      `macOS refused access to ${name}. The connector is marked Needs connecting. Check permissions on the computer.`,
    );
  } else if (isRefused) yield* markRefused(dependencies, entry);
  const line = warningOf(entry.name, errorClass);
  if (line !== null) yield* dependencies.notices.warn(threadId, line);
  return toolRefusal(failureSentenceOf[errorClass]);
});

/** Applies a permission loss to existing turns without cancelling the call that reports it. */
export const narrowPermittedTools = Effect.fnUntraced(function* (
  dependencies: CallDependencies,
  except: string | null,
) {
  yield* dependencies.calls.narrowSnapshots((id) =>
    readOfferedTools(dependencies, id).pipe(
      Effect.map((tools) => new Set(tools.map((tool) => tool.listedName))),
      Effect.orDie,
    ),
  );
  yield* dependencies.calls.stopRevokedExcept(except);
});

/** Hands the call to the connector's server with its secret, which the Vault lends for this call alone. */
const dispatch = Effect.fnUntraced(function* (
  dependencies: CallDependencies,
  entry: CatalogEntry,
  invocation: Invocation,
  tool: string,
  args: unknown,
) {
  // A write is never retried by Outlore: a cancelled or failed one may already have happened. A read may be, once.
  const isRead = catalogToolOf(entry, tool)?.class === "Read";
  invocation.markDispatched();
  const attempt = dependencies.listing.withCredentials(entry, (backend, secret) =>
    backend
      .call(tool, args, secret)
      .pipe(Effect.map((text) => cappedOf(redactedOf(text, secret === null ? [] : [secret])))),
  );
  const outcome = yield* (
    isRead
      ? attempt.pipe(
          Effect.retry({
            times: 1,
            while: (failure) => failure._tag === "BackendFailure" && failure.class === "Unreachable",
          }),
        )
      : attempt
  ).pipe(Effect.result);
  return outcome._tag === "Success"
    ? toolText(outcome.success)
    : yield* recordFailure(
        dependencies,
        entry,
        invocation.threadId,
        outcome.failure,
        invocation,
        catalogToolOf(entry, tool)?.app ?? null,
      );
});

/** The answer for a call a switch stopped. */
const stoppedAnswerOf = (entry: CatalogEntry, tool: string, invocation: Invocation) =>
  invocation.isDispatched() && catalogToolOf(entry, tool)?.class !== "Read"
    ? toolRefusal(refusals.cancelledAfterDispatch)
    : toolRefusal(refusals.cancelled);

const runCall = Effect.fnUntraced(function* (
  dependencies: CallDependencies,
  invocation: Invocation,
  entry: CatalogEntry,
  tool: string,
  args: unknown,
) {
  const listedName = invocation.listedName;
  // A tool the catalog names, or the thread was offered this turn, is known even when its connector has since been
  // forgotten or switched off: the thread is told the connector is off for it, not that the tool does not exist.
  const isKnown =
    catalogToolOf(entry, tool) !== null ||
    dependencies.listing.cachedTools(entry.id).some((listed) => listed.name === tool) ||
    dependencies.calls.snapshotOf(invocation.threadId)?.has(listedName) === true;
  if (!isKnown) return unknownToolAnswer(listedName);
  const refused = yield* refusalOf(dependencies, invocation.threadId, listedName);
  if (refused !== null) return refused;
  if (catalogToolOf(entry, tool)?.class !== "Read") {
    const decision = yield* dependencies.asking.askToolUse(invocation.threadId, questionOf(entry, tool, args));
    if (!decision.isAllowed) return toolRefusal(refusals.denied(decision.text));
    // The owner took their time: the switches may have changed while the thread waited.
    const refusedAfter = yield* refusalOf(dependencies, invocation.threadId, listedName);
    if (refusedAfter !== null) return refusedAfter;
  }
  return yield* dispatch(dependencies, entry, invocation, tool, args);
});

/** Calls one connector tool for the thread; a refusal or a failure is an error answer, never a failure. */
export const makeCall =
  (dependencies: CallDependencies) =>
  (threadId: string, listedName: string, args: unknown): Effect.Effect<ToolAnswer> =>
    Effect.gen(function* () {
      const parts = splitListedName(listedName);
      const entry = parts === null ? null : entryOf(dependencies.catalog, parts.connector);
      if (parts === null || entry === null) return unknownToolAnswer(listedName);
      // Registered before any policy is read, so a switch that commits meanwhile finds the call (the timing contract).
      return yield* dependencies.calls.track({ connector: entry.id, listedName, threadId }, (invocation) =>
        Effect.raceFirst(
          runCall(dependencies, invocation, entry, parts.tool, args),
          Deferred.await(invocation.stopped).pipe(Effect.map(() => stoppedAnswerOf(entry, parts.tool, invocation))),
        ),
      );
    }).pipe(Effect.orDie);

/** The tools a thread is offered, as the gateway lists them: those its snapshot holds, with the server's descriptions. */
export const listOfferedTools = Effect.fnUntraced(function* (
  dependencies: CallDependencies,
  threadId: string,
): Effect.fn.Return<ReadonlyArray<OfferedConnectorTool>, SqlError.SqlError> {
  const offered = yield* readOfferedTools(dependencies, threadId);
  const snapshot = dependencies.calls.snapshotOf(threadId);
  return snapshot === null ? offered : offered.filter((tool) => snapshot.has(tool.listedName));
});

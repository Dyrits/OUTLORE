import { RitualScope as RitualScopeSchema } from "@outlore/contracts";
import { Context, Effect, Match, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { readSettings, type ServiceFailure, type ToolAnswer, toolRefusal } from "../core/index.ts";
import { isNamedByOwner, type NamedAction } from "../policy/index.ts";
import type { Approvals } from "./approvals.ts";
import { previewEnding, readWorkingIds } from "./ending.ts";
import { fallbackNoteOf, ritualStartOf } from "./guildmasterCompanions.ts";
import { isGuildmasterThread } from "./guildmasterPlace.ts";
import { readRitualPreflight, readSettingChange } from "./guildmasterPreflight.ts";
import { clip, placeOf, threadsLineOf } from "./guildmasterText.ts";
import { isRitualRunTurn, readOwnerTexts } from "./messageProvenance.ts";
import { deriveRealmCreation, deriveRealmRename } from "./realmActions.ts";
import { readRitualEdit } from "./ritualEdits.ts";
import { coveringEntryOf, type ScopedAction } from "./ritualScope.ts";
import type { ArgumentsOf } from "./threadTools.ts";
import { titleOf } from "./titles.ts";
import { readRunningTurnId } from "./turnAdmission.ts";

// Structural actions by provenance (CHG-0208), replacing the quoted-words check and the one-click guards. The service
// derives the operation, its resolved target and its new value from the tool call. The authority comes from the owner:
// their own message of the current turn naming that action exactly, or a Ritual's reviewed scope during one of its
// runs; otherwise one exact question, Allow or Deny. The model supplies no evidence, and agent-written text (thread
// messages, reports, a Ritual's run message) is never the owner's.

/** The tools that change the app's structure, each derived and authorized here before it runs. */
export type StructuralTool =
  | "act_on_mission"
  | "change_setting"
  | "create_realm"
  | "rename_realm"
  | "create_ritual"
  | "edit_ritual";

/** A structural action as the service derived it from a tool call. */
type DerivedAction = {
  readonly details: string;
  /** Everything the action depends on, compared again when it runs: the turn, the target, the threads at work. */
  readonly fingerprint: string;
  /** Whether it must be asked whatever the owner wrote: an ending that would stop threads at work. */
  readonly shouldAsk: boolean;
  /** How the owner would name it: operation, target names, new value, and rival targets of the same kind. */
  readonly named: NamedAction;
  /** How a Ritual's scope entry would name it, or null when no scope can cover it. */
  readonly scoped: ScopedAction | null;
  /** The exact action and target, as the question and the record show it. */
  readonly summary: string;
};

/**
 * The Ritual this thread serves — directly as its conversation thread, or as a run errand directly beneath it — with
 * its reviewed scope; null for any other thread (CHG-0616: a Ritual's runs are errands).
 */
const readRitualOfThread = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ authority: string }>`
      SELECT r.authority FROM rituals r
      JOIN missions m ON m.id = r.mission_id
      JOIN threads t ON t.id = ${threadId}
      WHERE m.top_thread_id = t.id OR (t.parent_id IS NOT NULL AND m.top_thread_id = t.parent_id)`;
  return row === undefined ? null : { scope: Schema.decodeUnknownSync(RitualScopeSchema)(JSON.parse(row.authority)) };
});

/**
 * Ritual creation and editing check their callers during preflight. Other structural tools are limited to the
 * control conversation and actions a Ritual run can take on a quest or setting.
 */
export const isStructuralCaller = Effect.fnUntraced(function* (threadId: string, tool: StructuralTool) {
  if (tool === "create_ritual" || tool === "edit_ritual" || (yield* isGuildmasterThread(threadId))) return true;
  if (!structuralTools[tool].canRitualCall) return false;
  return (yield* readRitualOfThread(threadId)) !== null;
});

/** A value as the owner would write it: a text without its JSON quotes, anything else as JSON. */
const spokenOf = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value));

/** What a tool's derivation found: the action as the question, the owner's words, and a Ritual's scope would name it. */
type Found = {
  readonly named: NamedAction;
  readonly scoped: ScopedAction | null;
  readonly state: unknown;
  readonly summary: string;
  readonly shouldAsk: boolean;
  readonly details?: object;
};

/** How one structural tool is derived from its call, and whether a Ritual's own thread may call it. */
type StructuralSpec<Tool extends StructuralTool> = {
  readonly canRitualCall: boolean;
  /** The structural action the call would take; null when the tool's own checks will refuse it. */
  readonly derive: (
    args: ArgumentsOf<Tool>,
    callerId: string,
  ) => Effect.Effect<Found | null, ServiceFailure | SqlError, SqlClient.SqlClient>;
};

/** `act_on_mission` as a structural action: the quest by its id, and what Stop or an ending would stop. */
const deriveQuestAction = Effect.fnUntraced(function* (args: ArgumentsOf<"act_on_mission">) {
  const sql = yield* SqlClient.SqlClient;
  const [quest] = yield* sql<{ id: string; title: string; ending: string | null }>`
      SELECT m.id, m.title, m.ending FROM missions m JOIN threads top ON top.id = m.top_thread_id
      WHERE m.id = ${args.mission} AND m.is_guildmaster = 0 AND top.is_deleting = 0`;
  if (quest === undefined) return null;
  const rivals = (yield* sql<{ title: string }>`
      SELECT title FROM missions WHERE is_guildmaster = 0 AND id <> ${quest.id}`).map((row) => row.title);
  const targets = [quest.title];
  const scopeTargets = [quest.id, quest.title];
  if (args.action === "Rename") {
    const title = titleOf(args.title ?? "");
    if (title === "") return null;
    return {
      named: { operation: "Rename", rivals, targets, value: title },
      scoped: { operation: "Rename", payload: title, targets: scopeTargets },
      shouldAsk: false,
      state: { quest },
      summary: `Rename the quest "${quest.title}" to "${title}".`,
    } satisfies Found;
  }
  if (args.action === "Stop") {
    const ids = yield* readWorkingIds(quest.id).pipe(Effect.catchTag("ServiceFailure", () => Effect.succeed([])));
    if (ids.length === 0) return null;
    return {
      named: { operation: "Stop", rivals, targets, value: null },
      scoped: { operation: "Stop", payload: null, targets: scopeTargets },
      shouldAsk: false,
      state: { ids, quest },
      summary: `Stop the ${threadsLineOf(ids.length)} at work in the quest "${quest.title}".`,
    } satisfies Found;
  }
  const ending = args.action === "Done" ? "Fulfilled" : "Archived";
  const preview = yield* previewEnding(quest.id, ending).pipe(
    Effect.catchTag("ServiceFailure", () => Effect.succeed(null)),
  );
  if (preview === null) return null;
  const what = args.action === "Done" ? `Mark the quest "${quest.title}" Done.` : `Archive the quest "${quest.title}".`;
  return {
    named: { operation: args.action, rivals, targets, value: null },
    scoped: { operation: args.action, payload: null, targets: scopeTargets },
    shouldAsk: preview.question !== null,
    state: { quest, snapshot: preview.snapshot },
    // Stopping threads at work is part of it: always one question, bound to the threads it names.
    summary: preview.question === null ? what : `${what} ${preview.question}`,
  } satisfies Found;
});

/** `change_setting` as a structural action: one setting, its value as JSON, and what it holds now. */
const deriveSettingChange = Effect.fnUntraced(function* (args: ArgumentsOf<"change_setting">) {
  const checked = yield* readSettingChange(args);
  return Match.valueTags(checked, {
    Clear: ({ before, setting, value }) =>
      ({
        named: { operation: "ChangeSetting", targets: [setting], value: spokenOf(value) },
        scoped: { operation: "ChangeSetting", payload: JSON.stringify(value), targets: [setting] },
        shouldAsk: false,
        state: { before, setting, value },
        summary: `Change the setting ${setting} from ${JSON.stringify(before)} to ${JSON.stringify(value)}.`,
      }) satisfies Found,
    Refused: () => null,
  });
});

/** `create_ritual` as a structural action: the Ritual with its Companion, realm, and schedule, always asked. */
const deriveRitualCreation = Effect.fnUntraced(function* (args: ArgumentsOf<"create_ritual">, callerId: string) {
  const checked = yield* readRitualPreflight(callerId, args);
  if (checked._tag === "Refused") return null;
  const { originMissionId, realm, realmId, title } = checked;
  const { companion, fallbacks } = ritualStartOf(yield* readSettings, args);
  return {
    details: { companion, fallbacks, instruction: args.instruction, schedule: args.schedule },
    named: { operation: "CreateRitual", targets: [title], value: null },
    scoped: null,
    // A Ritual runs unattended, so the owner always sees its instruction, schedule, realm, and Companion before it
    // exists: naming the title in a message authorizes none of them (audit SA-01, SA-05).
    shouldAsk: true,
    state: { companion, fallbacks, originMissionId, realm, realmId, title },
    summary: `Create the Ritual "${title}", ${JSON.stringify(args.schedule)}, ${placeOf(realm)}, on ${companion.harness} ${companion.model}${fallbackNoteOf(fallbacks, args.tier ?? null)}.`,
  } satisfies Found;
});

/** Derives the exact edit and the current configuration the owner's approval depends on. */
const deriveRitualEdit = Effect.fnUntraced(function* (args: ArgumentsOf<"edit_ritual">, callerId: string) {
  const checked = yield* readRitualEdit(callerId, args);
  if (checked._tag === "Refused") return null;
  const { before, changes, realm, ritualId } = checked;
  return {
    details: { changes, realm },
    named: { operation: "EditRitual", targets: [before.title], value: null },
    scoped: null,
    shouldAsk: true,
    state: { before, realm, ritualId },
    summary: `Edit the Ritual "${before.title}" ${placeOf(realm)}.`,
  } satisfies Found;
});

/** Every structural tool, derived from its call; a Ritual's own thread may call only those its scope can cover. */
const structuralTools: { readonly [Tool in StructuralTool]: StructuralSpec<Tool> } = {
  act_on_mission: { canRitualCall: true, derive: deriveQuestAction },
  change_setting: { canRitualCall: true, derive: deriveSettingChange },
  create_realm: { canRitualCall: false, derive: deriveRealmCreation },
  create_ritual: { canRitualCall: false, derive: deriveRitualCreation },
  edit_ritual: { canRitualCall: false, derive: deriveRitualEdit },
  rename_realm: { canRitualCall: false, derive: deriveRealmRename },
};

/** Derives the structural action a tool call would take; null when the tool's own checks will refuse it. Exported for the test that pins the receipt's fingerprint. */
export const deriveAction = Effect.fnUntraced(function* <Tool extends StructuralTool>(
  callerId: string,
  tool: Tool,
  args: ArgumentsOf<Tool>,
) {
  if (!(yield* isStructuralCaller(callerId, tool))) return null;
  const turnId = yield* readRunningTurnId(callerId);
  if (turnId === null) return null;
  const base = { args, callerId, tool, turnId };
  const spec: StructuralSpec<Tool> = structuralTools[tool];
  const found = yield* spec.derive(args, callerId);
  if (found === null) return null;
  return {
    details: JSON.stringify({ action: found.named.operation, ...(found.details ?? {}), state: found.state }, null, 2),
    // The receipt compares this text byte for byte: the call first, then the state, in this order.
    fingerprint: JSON.stringify({ ...base, state: found.state }),
    named: found.named,
    scoped: found.scoped,
    shouldAsk: found.shouldAsk,
    summary: found.summary,
  } satisfies DerivedAction;
});

/** Where the authority for a derived action comes from, or that the owner must be asked. */
type Authority =
  | { readonly _tag: "Owner"; readonly evidence: string }
  | { readonly _tag: "Scope"; readonly evidence: string }
  | { readonly _tag: "Ask" };

/** The owner's own words of this turn naming the action exactly, or the Ritual's reviewed scope in a run; else ask. */
const readAuthority = Effect.fnUntraced(function* (callerId: string, derived: DerivedAction) {
  const turnId = yield* readRunningTurnId(callerId);
  if (turnId === null || derived.shouldAsk) return { _tag: "Ask" } satisfies Authority;
  const named = (yield* readOwnerTexts(callerId, turnId)).find((text) => isNamedByOwner(text, derived.named));
  if (named !== undefined) return { _tag: "Owner", evidence: clip(named, 400) } satisfies Authority;
  if (derived.scoped !== null) {
    const ritual = yield* readRitualOfThread(callerId);
    if (ritual !== null && (yield* isRitualRunTurn(callerId, turnId))) {
      const entry = coveringEntryOf(ritual.scope, derived.scoped);
      if (entry !== null)
        return {
          _tag: "Scope",
          evidence: `The Ritual's reviewed scope: ${entry.operation} ${entry.target}${entry.payload === null ? "" : ` → ${entry.payload}`}`,
        } satisfies Authority;
    }
  }
  return { _tag: "Ask" } satisfies Authority;
});

/** The one-use proof, handed only to this invocation, that its exact action was authorized. */
type Receipt = {
  readonly fingerprint: string;
  isUsed: boolean;
  readonly key: string;
};

// Only the fiber that ran the authorization holds it; tool arguments cannot make one.
const receiptReference = Context.Reference<Receipt | null>("outlore/StructuralReceipt", { defaultValue: () => null });
const keyOf = (callerId: string, tool: StructuralTool, args: object) => JSON.stringify([callerId, tool, args]);

/**
 * Spends this invocation's receipt inside the mutation's transaction, after deriving the action again: a changed turn,
 * target, value, or set of threads at work means it no longer matches what was authorized, and nothing runs.
 */
export const consumeReceipt = Effect.fnUntraced(function* <Tool extends StructuralTool>(
  callerId: string,
  tool: Tool,
  args: ArgumentsOf<Tool>,
) {
  const receipt = yield* receiptReference;
  if (receipt === null || receipt.isUsed || receipt.key !== keyOf(callerId, tool, args)) return false;
  receipt.isUsed = true;
  const now = yield* deriveAction(callerId, tool, args).pipe(Effect.orDie);
  return now !== null && now.fingerprint === receipt.fingerprint;
});

/** What a structural tool says when its action was not authorized, or changed before it could run. */
export const notAuthorizedText =
  "Not done: the owner did not authorize this exact action, or its quest, realm, setting, turn, or threads at work changed meanwhile. Nothing was changed.";

/**
 * Authorizes one structural tool call by provenance, outside any transaction, then runs it with a one-use receipt.
 * A call whose action cannot be derived runs without one, so the tool's own checks refuse it with their reason.
 */
export const withProvenance = Effect.fnUntraced(function* <Tool extends StructuralTool>(
  approvals: Approvals["Service"],
  read: <A, E>(work: Effect.Effect<A, E, SqlClient.SqlClient>) => Effect.Effect<A>,
  callerId: string,
  tool: Tool,
  args: ArgumentsOf<Tool>,
  run: (authorize: <A, E, R>(work: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>) => Effect.Effect<ToolAnswer>,
) {
  const derived = yield* read(deriveAction(callerId, tool, args));
  if (derived === null) return yield* run((work) => work);
  const authority = yield* read(readAuthority(callerId, derived));
  const refusal = yield* Match.valueTags(authority, {
    Ask: () =>
      approvals
        .confirmAction(callerId, derived.summary, derived.details)
        .pipe(Effect.map((decision) => (decision.isAllowed ? null : toolRefusal(decision.text)))),
    Owner: () => Effect.succeed(null),
    Scope: () => Effect.succeed(null),
  });
  if (refusal !== null) return refusal;
  const receipt: Receipt = { fingerprint: derived.fingerprint, isUsed: false, key: keyOf(callerId, tool, args) };
  const answer = yield* run((work) => Effect.provideService(work, receiptReference, receipt));
  // A tool that reports success without spending the receipt changed something its authorization never covered: a
  // defect in the tool, which no caller can recover from.
  if (!answer.isError && !receipt.isUsed)
    return yield* Effect.die(new Error(`${tool} succeeded without spending its authorization receipt.`));
  if (answer.isError) return answer;
  // The owner already answered a question that was asked; otherwise the allowance is recorded with its evidence.
  yield* Match.valueTags(authority, {
    Ask: () => Effect.void,
    Owner: ({ evidence }) =>
      approvals.recordDecision(callerId, derived.summary, derived.details, "AllowedByMessage", evidence),
    Scope: ({ evidence }) =>
      approvals.recordDecision(callerId, derived.summary, derived.details, "AllowedByPermission", evidence),
  });
  return answer;
});

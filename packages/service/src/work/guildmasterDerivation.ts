import { RitualScope as RitualScopeSchema } from "@outlore/contracts";
import { Effect, Match, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { readSettings, type ServiceFailure } from "../core/index.ts";
import type { NamedAction } from "../policy/index.ts";
import { previewEnding, readWorkingIds } from "./ending.ts";
import { fallbackNoteOf, ritualStartOf } from "./guildmasterCompanions.ts";
import { isGuildmasterThread, settingWriterOfCaller } from "./guildmasterPlace.ts";
import { readRitualPreflight, readSettingChange } from "./guildmasterPreflight.ts";
import { placeOf, threadsLineOf } from "./guildmasterText.ts";
import { isVisibleQuestOf, questsFrom } from "./questVisibility.ts";
import { deriveRealmCreation, deriveRealmRename } from "./realmActions.ts";
import { readRitualEdit } from "./ritualEdits.ts";
import type { ScopedAction } from "./ritualScope.ts";
import type { ArgumentsOf } from "./threadTools.ts";
import { titleOf } from "./titles.ts";
import { readRunningTurnId } from "./turnAdmission.ts";

// Deriving a structural action from a tool call (CHG-0208): the operation, its resolved target and its new value, as the
// question the owner sees and the words that would name it. Authorizing it is in guildmasterProvenance.ts.

/** The tools that change the app's structure, each derived and authorized here before it runs. */
export type StructuralTool =
  | "act_on_mission"
  | "change_setting"
  | "create_realm"
  | "rename_realm"
  | "create_ritual"
  | "edit_ritual";

/** A structural action as the service derived it from a tool call. */
export type DerivedAction = {
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
export const readRitualOfThread = Effect.fnUntraced(function* (threadId: string) {
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
      WHERE m.id = ${args.mission} AND ${isVisibleQuestOf(sql)}`;
  if (quest === undefined) return null;
  const rivals = (yield* sql<{ title: string }>`
      SELECT m.title FROM ${questsFrom(sql)} WHERE ${isVisibleQuestOf(sql)} AND m.id <> ${quest.id}`).map(
    (row) => row.title,
  );
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
const deriveSettingChange = Effect.fnUntraced(function* (args: ArgumentsOf<"change_setting">, callerId: string) {
  const checked = yield* readSettingChange(yield* settingWriterOfCaller(callerId), args);
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

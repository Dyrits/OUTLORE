import type { AccountId } from "@outlore/contracts";
import { Effect } from "effect";
import { readSettings } from "../core/index.ts";
import { changed, unchanged } from "./followUps.ts";
import { recordResolvedCard } from "./guildmasterCards.ts";
import { companionLineOf, ritualStartOf } from "./guildmasterCompanions.ts";
import { readRitualPreflight } from "./guildmasterPreflight.ts";
import { consumeReceipt, notAuthorizedText } from "./guildmasterProvenance.ts";
import { placeOf } from "./guildmasterText.ts";
import { readRitualEdit } from "./ritualEdits.ts";
import { createRitual, updateRitual } from "./rituals.ts";
import type { ArgumentsOf } from "./threadTools.ts";

/** What a Ritual creation or edit came to. */
export type RitualToolOutcome =
  | { readonly _tag: "Done"; readonly text: string }
  | { readonly _tag: "Refused"; readonly reason: string };

/** A refused Ritual operation, which changes nothing. */
export const refuseRitual = (reason: string) => unchanged<RitualToolOutcome>({ _tag: "Refused", reason });

/** Creates an approved Ritual in the resolved realm and links it in the caller's conversation. */
export const createRitualByThread = Effect.fnUntraced(function* (callerId: string, args: ArgumentsOf<"create_ritual">) {
  const checked = yield* readRitualPreflight(callerId, args);
  if (checked._tag === "Refused") return refuseRitual(checked.text);
  const { originMissionId, realm, realmId, title } = checked;
  if (!(yield* consumeReceipt(callerId, "create_ritual", args))) return refuseRitual(notAuthorizedText);
  const { companion: runner, fallbacks } = ritualStartOf(yield* readSettings, args);
  const created = yield* createRitual({
    fallbacks,
    instruction: args.instruction,
    // An origin quest names the realm the Ritual lives in, keeping a visible link to it (rituals, Creation).
    originMissionId,
    primary: { ...runner, accountId: runner.accountId as AccountId | null },
    realm: originMissionId === null ? realm : null,
    realmId,
    schedule: args.schedule,
    title,
    workspacePath: originMissionId === null ? (realm?.path ?? null) : null,
  });
  yield* recordResolvedCard({
    callerId,
    isRitual: true,
    realmPath: realm?.path ?? null,
    target: { missionId: created.value.missionId, threadId: created.value.threadId, title },
    text: args.instruction,
    title,
  });
  const where = placeOf(realm);
  return changed<RitualToolOutcome>({
    _tag: "Done",
    text: `Created the Ritual "${title}" ${where}, ${JSON.stringify(args.schedule)}, on ${companionLineOf(args.tier ?? null, runner)}. It runs by itself when due on its realm's list among the quests, each run an errand beneath the Ritual, and is on. Tell the owner in a sentence what it will do and when; do not repeat the instruction.`,
  });
});

/** Edits only the approved fields of a Ritual, leaving the owner's reviewed scope in place. */
export const editRitualByThread = Effect.fnUntraced(function* (callerId: string, args: ArgumentsOf<"edit_ritual">) {
  const checked = yield* readRitualEdit(callerId, args);
  if (checked._tag === "Refused") return refuseRitual(checked.text);
  if (!(yield* consumeReceipt(callerId, "edit_ritual", args))) return refuseRitual(notAuthorizedText);
  const update = { ...checked.before, ...checked.changes, ritualId: checked.ritualId };
  yield* updateRitual(update);
  return changed<RitualToolOutcome>({
    _tag: "Done",
    text: `Edited the Ritual "${update.title}".`,
  });
});

import type { AccountId } from "@outlore/contracts";
import { Effect } from "effect";
import { readSettings } from "../core/index.ts";
import { changed, unchanged } from "./followUps.ts";
import { recordResolvedCard } from "./guildmasterCards.ts";
import { companionLineOf, ritualStartOf } from "./guildmasterCompanions.ts";
import { isGuildmasterThread } from "./guildmasterPlace.ts";
import { readRitualPreflight } from "./guildmasterPreflight.ts";
import { consumeReceipt, notAuthorizedText } from "./guildmasterProvenance.ts";
import { placeOf } from "./guildmasterText.ts";
import { createRitual } from "./rituals.ts";
import type { ArgumentsOf } from "./threadTools.ts";

/** What `create_ritual` came to. */
export type RitualCreatedByGuildmaster =
  | { readonly _tag: "Created"; readonly text: string }
  | { readonly _tag: "Refused"; readonly reason: string };

/** A refused `create_ritual`, which changes nothing. */
export const refuseRitual = (reason: string) => unchanged<RitualCreatedByGuildmaster>({ _tag: "Refused", reason });

/**
 * `create_ritual`: Chronicler makes a Ritual, an entity of its realm instead of a quest of its own, in a realm it
 * names or the realm of a quest it comes from, on its own Companion unless it chooses another, once authorized by
 * provenance. Its reviewed scope starts empty: only the owner sets it, in the Ritual's form. Nothing runs until it is
 * due; each run then opens an errand beneath the Ritual, and its history stays in the Ritual's own conversation.
 * The owner sees it as a card with a link. Only Chronicler calls it.
 */
export const createRitualByGuildmaster = Effect.fnUntraced(function* (
  callerId: string,
  args: ArgumentsOf<"create_ritual">,
) {
  if (!(yield* isGuildmasterThread(callerId))) return refuseRitual("Only Chronicler creates Rituals.");
  const checked = yield* readRitualPreflight(args);
  if (checked._tag === "Refused") return refuseRitual(checked.text);
  const { originMissionId, realm, title } = checked;
  if (!(yield* consumeReceipt(callerId, "create_ritual", args))) return refuseRitual(notAuthorizedText);
  const { companion: runner, fallbacks } = ritualStartOf(yield* readSettings, args);
  const created = yield* createRitual({
    fallbacks,
    instruction: args.instruction,
    // An origin quest names the realm the Ritual lives in, keeping a visible link to it (rituals, Creation).
    originMissionId,
    primary: { ...runner, accountId: runner.accountId as AccountId | null },
    realm: originMissionId === null ? realm : null,
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
  return changed<RitualCreatedByGuildmaster>({
    _tag: "Created",
    text: `Created the Ritual "${title}" ${where}, ${JSON.stringify(args.schedule)}, on ${companionLineOf(args.tier ?? null, runner)}. It runs by itself when due on its realm's list among the quests, each run an errand beneath the Ritual, and is on. Tell the owner in a sentence what it will do and when; do not repeat the instruction.`,
  });
});

import type { AccountId } from "@outlore/contracts";
import { Effect } from "effect";
import { readSettings } from "../core/index.ts";
import { changed, unchanged } from "./commands.ts";
import { recordResolvedCard } from "./guildmasterCards.ts";
import { companionLineOf, ritualStartOf } from "./guildmasterCompanions.ts";
import { isGuildmasterThread, readOptionalRealm } from "./guildmasterPlace.ts";
import { consumeReceipt, notAuthorizedText } from "./guildmasterProvenance.ts";
import { placeOf } from "./guildmasterText.ts";
import { createRitual } from "./rituals.ts";
import type { ArgumentsOf } from "./threadTools.ts";
import { ritualTitleOf, titleOf } from "./titles.ts";

/** What `create_ritual` came to. */
export type RitualCreatedByGuildmaster =
  | { readonly _tag: "Created"; readonly text: string }
  | { readonly _tag: "Refused"; readonly reason: string };

/** A refused `create_ritual`, which changes nothing. */
export const refuseRitual = (reason: string) => unchanged<RitualCreatedByGuildmaster>({ _tag: "Refused", reason });

/**
 * `create_ritual`: Chronicler makes a Ritual, an instruction that runs by itself on a schedule in a quest of its
 * own, in a realm it names or none, on its own Companion unless it chooses another, once authorized by provenance. Its
 * reviewed scope starts empty: only the owner sets it, in the Ritual's form. Nothing runs until it is due. The owner sees
 * it as a card with a link. Only Chronicler calls it.
 */
export const createRitualByGuildmaster = Effect.fnUntraced(function* (
  callerId: string,
  args: ArgumentsOf<"create_ritual">,
) {
  if (!(yield* isGuildmasterThread(callerId))) return refuseRitual("Only Chronicler creates Rituals.");
  if (args.instruction.trim() === "" || titleOf(args.title) === "")
    return refuseRitual("Give an instruction and a title.");
  const { isNamed, realm } = yield* readOptionalRealm(args.realm);
  if (isNamed && realm === null)
    return refuseRitual(
      `Not created: no realm "${args.realm}". Name one of the realms in your context, or leave it out.`,
    );
  if (!(yield* consumeReceipt(callerId, "create_ritual", args))) return refuseRitual(notAuthorizedText);
  const { companion: runner, fallbacks } = ritualStartOf(yield* readSettings, args);
  const title = ritualTitleOf(args.title);
  const created = yield* createRitual({
    fallbacks,
    instruction: args.instruction,
    primary: { ...runner, accountId: runner.accountId as AccountId | null },
    realm: null,
    schedule: args.schedule,
    title,
    workspacePath: realm?.path ?? null,
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
    text: `Created the Ritual "${title}" ${where}, ${JSON.stringify(args.schedule)}, on ${companionLineOf(args.tier ?? null, runner)}. It runs by itself in its own quest when due and is on. Tell the owner in a sentence what it will do and when; do not repeat the instruction.`,
  });
});

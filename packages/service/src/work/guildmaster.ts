import type { SenderKind } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { toolRefusal, toolText } from "../core/index.ts";
import { changed, unchanged } from "./commands.ts";
import { endMission, previewEnding } from "./ending.ts";
import { isGuildmasterThread } from "./guildmasterPlace.ts";
import { readQuestAction } from "./guildmasterPreflight.ts";
import { consumeReceipt, isStructuralCaller, notAuthorizedText } from "./guildmasterProvenance.ts";
import { clip, threadsLineOf } from "./guildmasterText.ts";
import type { ArgumentsOf } from "./threadTools.ts";
import { renameMission, titleOf } from "./titles.ts";

// Acting on quests and reading Chronicler's own history, its tools beside the files that hold its place
// (guildmasterPlace.ts), its context (guildmasterContext.ts), its Rituals (guildmasterRituals.ts) and its reports.

// ----- Acting on quests, at the owner's request -----

/** What `act_on_mission` came to: done, threads to stop outside the transaction, or a refusal. */
export type ActedOnQuest =
  | { readonly _tag: "Done"; readonly text: string }
  | { readonly _tag: "ToStop"; readonly ids: ReadonlyArray<string>; readonly text: string }
  | { readonly _tag: "Refused"; readonly text: string };

/** The outcome of an action Chronicler may not take, with the words that tell it why. */
export const refuseAction = (text: string) => unchanged<ActedOnQuest>({ _tag: "Refused", text });

/**
 * `act_on_mission`: renames a quest, ends it, or stops its threads at work, once its exact action was authorized by
 * provenance (guildmasterProvenance.ts): the owner's own words of this turn, a Ritual's reviewed scope in one of its
 * runs, or the owner's Allow. Chronicler calls it, and a Ritual's own thread within its scope; never on its own initiative.
 */
export const actOnMission = Effect.fnUntraced(function* (callerId: string, args: ArgumentsOf<"act_on_mission">) {
  if (!(yield* isStructuralCaller(callerId, "act_on_mission"))) return refuseAction("Only Chronicler acts on quests.");
  const checked = yield* readQuestAction(args);
  if (checked._tag === "Refused") return refuseAction(checked.text);
  const { ids, quest } = checked;
  if (!(yield* consumeReceipt(callerId, "act_on_mission", args))) return refuseAction(notAuthorizedText);
  if (args.action === "Rename") {
    yield* renameMission(args.mission, args.title ?? "");
    return changed<ActedOnQuest>({
      _tag: "Done",
      text: `Renamed the quest "${quest.title}" to "${titleOf(args.title ?? "")}".`,
    });
  }
  if (args.action === "Stop") {
    // Stopping runs outside the transaction, in the tool handler, which ends each turn; the receipt bound this set.
    return unchanged<ActedOnQuest>({
      _tag: "ToStop",
      ids,
      text: `Stopped ${threadsLineOf(ids.length)} of "${quest.title}".`,
    });
  }
  const ending = args.action === "Done" ? "Done" : "Archived";
  // The receipt matched the threads at work the question named, so the snapshot taken now is that one.
  const preview = yield* previewEnding(args.mission, ending);
  const done = yield* endMission(args.mission, ending, preview.snapshot, "Chronicler");
  return changed<ActedOnQuest>(
    {
      _tag: "Done",
      text:
        done.followUps.missionsToRemoveScratch.length > 0
          ? `Deleted "${quest.title}".`
          : `Marked "${quest.title}" ${ending === "Done" ? "Done" : "Archived"}.`,
    },
    done.followUps,
  );
});

/** What `read_control_history` answers: Chronicler's own older messages, newest first. */
export const readControlHistory = Effect.fnUntraced(function* (
  callerId: string,
  args: ArgumentsOf<"read_control_history">,
) {
  const sql = yield* SqlClient.SqlClient;
  if (!(yield* isGuildmasterThread(callerId))) return toolRefusal("Only Chronicler reads this.");
  const count = Math.min(Math.max(args.count ?? 10, 1), 40);
  const query = (args.query ?? "").trim().toLowerCase();
  const rows = yield* sql<{ sequence: number; sender: string; text: string }>`
      SELECT sequence, sender_kind AS sender, text FROM messages
      WHERE thread_id = ${callerId} AND (${args.before ?? null} IS NULL OR sequence < ${args.before ?? null})
        AND (${query} = '' OR instr(lower(text), ${query}) > 0)
      ORDER BY sequence DESC LIMIT ${count}`;
  if (rows.length === 0) return toolText("No such messages.");
  const who: Readonly<Record<string, string | undefined>> = {
    agent: "You",
    thread: "A quest",
    user: "The owner",
  } satisfies Record<SenderKind, string>;
  return toolText(
    rows.map((row) => `#${row.sequence} ${who[row.sender] ?? row.sender}: ${clip(row.text, 800)}`).join("\n\n"),
  );
});

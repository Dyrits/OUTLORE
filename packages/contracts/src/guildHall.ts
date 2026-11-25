import { Schema } from "effect";
import { Consumption } from "./budgets.ts";
import { MissionId, ThreadId } from "./ids.ts";

/**
 * Where the owner has Chronicler open from (quest coordination, Context): the screen's name as the app shows it, and the
 * quest the screen is about when it is one. Chronicler reads it with each message, to know what "this quest" means.
 */
export const Viewing = Schema.Struct({
  missionId: Schema.optionalKey(Schema.NullOr(MissionId)),
  screen: Schema.String.check(Schema.isMaxLength(60)),
});
export type Viewing = typeof Viewing.Type;

/** Where Chronicler's conversation is: its hidden quest and the thread the owner writes in. */
export const GuildmasterPlace = Schema.Struct({ missionId: MissionId, threadId: ThreadId });
export type GuildmasterPlace = typeof GuildmasterPlace.Type;

/**
 * The Guild Hall hub's recap of the period since the owner's last visit (quest coordination, Guild Hall as a hub): quests
 * finished, what the turns used, and Ritual runs. `since` is the start of the period, which the screen sends back
 * on later reads so the period stays fixed while the owner is there.
 */
export const GuildHallRecap = Schema.Struct({
  consumption: Consumption,
  /** The latest quests finished in the period, at most five. */
  finished: Schema.Array(Schema.Struct({ missionId: MissionId, title: Schema.String })),
  finishedCount: Schema.Number,
  /** Whether the owner never visited before, when the period is the last 24 hours. */
  isFirstVisit: Schema.Boolean,
  ritualRuns: Schema.Number,
  since: Schema.Number,
});
export type GuildHallRecap = typeof GuildHallRecap.Type;

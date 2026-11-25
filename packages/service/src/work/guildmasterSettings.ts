import { Effect, Match } from "effect";
import {
  readSettings,
  settingsKeptFrom,
  type ToolAnswer,
  toolRefusal,
  toolText,
  writeSettings,
} from "../core/index.ts";
import { changed, unchanged, type WithFollowUps } from "./followUps.ts";
import { isStructuralCaller } from "./guildmasterDerivation.ts";
import { isGuildmasterThread, settingWriterOfCaller } from "./guildmasterPlace.ts";
import { readSettingChange } from "./guildmasterPreflight.ts";
import { consumeReceipt, notAuthorizedText } from "./guildmasterProvenance.ts";
import type { ArgumentsOf } from "./threadTools.ts";

// Chronicler's settings tools (quest coordination, CHG-0193): it reads the owner's settings, and changes one once the exact
// change is authorized by provenance (guildmasterProvenance.ts, CHG-0208). Chronicler calls them, and a Ritual's own thread
// within its reviewed scope; never on its own initiative.

const refused = (text: string): WithFollowUps<ToolAnswer> => unchanged(toolRefusal(text));

/** `read_settings`: the owner's settings as JSON, with the names Chronicler may not change. Only Chronicler reads them. */
export const readSettingsByGuildmaster = Effect.fnUntraced(function* (callerId: string) {
  if (!(yield* isGuildmasterThread(callerId))) return refused("Only Chronicler reads the settings here.");
  const settings = yield* readSettings;
  return unchanged(
    toolText(
      `${JSON.stringify(settings)}\n\nYou may not change: ${settingsKeptFrom("Chronicler").join(", ")}; the owner sets those in the Workshop.`,
    ),
  );
});

/**
 * `change_setting`: sets one setting to a new value, kept whole, as the settings screen would save it; refused for a
 * setting kept from Chronicler, an unknown one, or a value the setting does not accept.
 */
export const changeSettingByGuildmaster = Effect.fnUntraced(
  function* (callerId: string, args: ArgumentsOf<"change_setting">) {
    if (!(yield* isStructuralCaller(callerId, "change_setting")))
      return refused("Only Chronicler changes the settings here.");
    const writer = yield* settingWriterOfCaller(callerId);
    return yield* Match.valueTags(yield* readSettingChange(writer, args), {
      Clear: Effect.fnUntraced(function* ({ after, before, setting, value }) {
        if (!(yield* consumeReceipt(callerId, "change_setting", args))) return refused(notAuthorizedText);
        yield* writeSettings(writer, after);
        return changed(
          toolText(
            `Changed ${setting} from ${JSON.stringify(before)} to ${JSON.stringify(value)}. Tell the owner in a sentence.`,
          ),
        );
      }),
      Refused: ({ text }) => Effect.succeed(refused(text)),
    });
  },
  Effect.catchTag("ServiceFailure", (failure) => Effect.succeed(refused(`Not done: ${failure.message}`))),
);

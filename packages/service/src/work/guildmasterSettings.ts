import { Settings } from "@outlore/contracts";
import { Effect, Exit, Schema } from "effect";
import { readSettings, type ToolAnswer, writeSettings } from "../core/index.ts";
import { changed, unchanged, type WithFollowUps } from "./commands.ts";
import { isGuildmasterThread } from "./guildmasterPlace.ts";
import { consumeReceipt, isStructuralCaller, notAuthorizedText } from "./guildmasterProvenance.ts";
import { isChangeableSetting, isKeptFromChronicler, settingsKeptFromChronicler } from "./guildmasterSettingNames.ts";
import { parseJson } from "./guildmasterText.ts";
import type { ArgumentsOf } from "./threadTools.ts";

// Chronicler's settings tools (quest coordination, CHG-0193): it reads the owner's settings, and changes one once the exact
// change is authorized by provenance (guildmasterProvenance.ts, CHG-0208). Chronicler calls them, and a Ritual's own thread
// within its reviewed scope; never on its own initiative.

/** Kept for ritualScope.ts, which is not in this slice and should import it from guildmasterSettingNames.ts. */
export { changeableSettings } from "./guildmasterSettingNames.ts";

const refused = (text: string): WithFollowUps<ToolAnswer> => unchanged({ isError: true, text });

/** `read_settings`: the owner's settings as JSON, with the names Chronicler may not change. Only Chronicler reads them. */
export const readSettingsByGuildmaster = Effect.fnUntraced(function* (callerId: string) {
  if (!(yield* isGuildmasterThread(callerId))) return refused("Only Chronicler reads the settings here.");
  const settings = yield* readSettings;
  return unchanged({
    isError: false,
    text: `${JSON.stringify(settings)}\n\nYou may not change: ${settingsKeptFromChronicler.join(", ")}; the owner sets those in the Workshop.`,
  } satisfies ToolAnswer);
});

/**
 * `change_setting`: sets one setting to a new value, kept whole, as the settings screen would save it; refused for a
 * setting kept from Chronicler, an unknown one, or a value the setting does not accept.
 */
export const changeSettingByGuildmaster = (callerId: string, args: ArgumentsOf<"change_setting">) =>
  Effect.gen(function* () {
    if (!(yield* isStructuralCaller(callerId, "change_setting")))
      return refused("Only Chronicler changes the settings here.");
    if (isKeptFromChronicler(args.setting))
      return refused(`Not done: ${args.setting} is the owner's alone to change, in the Workshop. Tell them where.`);
    const setting = args.setting;
    if (!isChangeableSetting(setting))
      return refused(`Not done: no setting "${args.setting}". Read the settings first; use a name from them.`);
    const parsed = parseJson(args.value);
    if (Exit.isFailure(parsed))
      return refused(`Not done: value must be JSON text, such as true, 14, or "Steer"; ${args.value} is not.`);
    const value = parsed.value;
    const before = yield* readSettings;
    // The value must decode as the setting, whole: a wrong shape or range changes nothing.
    const after = Schema.decodeUnknownExit(Settings)({ ...before, [setting]: value });
    if (Exit.isFailure(after))
      return refused(
        `Not done: ${JSON.stringify(value)} is not a value ${args.setting} accepts. Read the settings for its shape.`,
      );
    if (!(yield* consumeReceipt(callerId, "change_setting", args))) return refused(notAuthorizedText);
    yield* writeSettings(after.value);
    return changed({
      isError: false,
      text: `Changed ${args.setting} from ${JSON.stringify(before[setting])} to ${JSON.stringify(value)}. Tell the owner in a sentence.`,
    } satisfies ToolAnswer);
  }).pipe(Effect.catchTag("ServiceFailure", (failure) => Effect.succeed(refused(`Not done: ${failure.message}`))));

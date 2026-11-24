import type { Settings } from "@outlore/contracts";
import { Effect } from "effect";
import { readSettings, type SettingWriter, writeSettings } from "../core/index.ts";
import { applyGlobalBudget } from "./budgets.ts";
import { Commands } from "./commands.ts";
import { changed } from "./followUps.ts";

/** Saves settings from the current row as the named writer, then applies any change to the global budget. */
export const saveSettings = Effect.fnUntraced(function* (writer: SettingWriter, next: (saved: Settings) => Settings) {
  const commands = yield* Commands;
  const saved = yield* commands.run(
    Effect.gen(function* () {
      const before = yield* readSettings;
      const settings = yield* writeSettings(writer, next(before));
      return changed({ before: before.globalBudget, settings });
    }),
  );
  yield* commands.run(applyGlobalBudget(saved.before));
  return saved.settings;
});

import type { Settings } from "@outlore/contracts";
import { Effect } from "effect";
import { readSettings, writeSettings } from "../core/index.ts";
import { applyGlobalBudget } from "./budgets.ts";
import { Commands, changed } from "./commands.ts";

/** Saves settings from the current row, then applies any change to the global budget. */
export const saveSettings = (next: (saved: Settings) => Settings) =>
  Effect.gen(function* () {
    const commands = yield* Commands;
    const saved = yield* commands.run(
      Effect.gen(function* () {
        const before = yield* readSettings;
        const settings = yield* writeSettings(next(before));
        return changed({ before: before.globalBudget, settings });
      }),
    );
    yield* commands.run(applyGlobalBudget(saved.before));
    return saved.settings;
  });

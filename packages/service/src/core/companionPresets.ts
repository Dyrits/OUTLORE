import { type CompanionPresetEdit, TierName } from "@outlore/contracts";
import { Effect } from "effect";
import { invalid } from "./errors.ts";
import { readSettings, writeSettings } from "./settings.ts";

const nameKeyOf = (name: string) => name.trim().toLowerCase();

/** Saves a single library edit inside the caller's command transaction. */
export const changeCompanionPreset = Effect.fnUntraced(function* (edit: CompanionPresetEdit) {
  const saved = yield* readSettings;
  const { custom, tierNames } = saved.companionPresets ?? { custom: [], tierNames: {} };
  const tiers = { ...saved.tiers };
  const names = { ...tierNames };
  const matches = (name: string) => nameKeyOf(name) === nameKeyOf(edit.name);
  const tier = TierName.literals.find((key) => tiers[key] !== null && matches(names[key] ?? key));
  const existing = custom.find((preset) => matches(preset.name));
  if (edit._tag !== "Add" && tier === undefined && existing === undefined) {
    return yield* invalid("This preset no longer exists.");
  }

  if (edit._tag === "Add" || edit._tag === "Rename") {
    const name = (edit._tag === "Add" ? edit.name : edit.nextName).trim();
    if (name.length === 0) return yield* invalid("Enter a preset name.");
    const key = nameKeyOf(name);
    // Reserve the built-in names so an unset tier can always be set again.
    const owner = edit._tag === "Rename" ? tier : undefined;
    const isTaken =
      TierName.literals.some(
        (candidate) =>
          candidate !== owner && (nameKeyOf(candidate) === key || nameKeyOf(names[candidate] ?? candidate) === key),
      ) || custom.some((preset) => (edit._tag === "Add" || preset !== existing) && nameKeyOf(preset.name) === key);
    if (isTaken) return yield* invalid("That preset name is already in use. Choose another name.");
    if (edit._tag === "Add") {
      return yield* writeSettings({
        ...saved,
        companionPresets: { custom: [...custom, { name, stack: edit.stack }], tierNames },
      });
    }
    if (tier !== undefined) names[tier] = name;
    return yield* writeSettings({
      ...saved,
      companionPresets: {
        custom: custom.map((preset) => (preset === existing ? { ...preset, name } : preset)),
        tierNames: names,
      },
    });
  }

  if (tier !== undefined) {
    tiers[tier] = edit._tag === "Delete" ? null : edit.stack;
    if (edit._tag === "Delete") delete names[tier];
  }
  const next =
    edit._tag === "Delete"
      ? custom.filter((preset) => preset !== existing)
      : custom.map((preset) => (preset === existing ? { ...preset, stack: edit.stack } : preset));
  return yield* writeSettings({ ...saved, companionPresets: { custom: next, tierNames: names }, tiers });
});

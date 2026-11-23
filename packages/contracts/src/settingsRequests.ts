import { Schema, Struct } from "effect";
import { PresetName, Tier } from "./companions.ts";
import { Settings } from "./records.ts";

/** Saves the owner's settings. */
export const UpdateSettings = Schema.TaggedStruct("UpdateSettings", {
  settings: Settings.mapFields(({ companionPresets: _companionPresets, ...fields }) => fields),
});
/** Changes some of the owner's settings, merged into the saved ones by the service, so a change made elsewhere meanwhile is kept; of the tiers, only those named change. */
export const ChangeSettings = Schema.TaggedStruct("ChangeSettings", {
  change: Settings.mapFields(({ companionPresets: _companionPresets, ...fields }) => ({
    ...Struct.map(Schema.optionalKey)(fields),
    tiers: Schema.optionalKey(fields.tiers.mapFields(Struct.map(Schema.optionalKey))),
  })),
});
export type SettingsChange = typeof ChangeSettings.Type.change;

/** Changes one preset against the host's current library. */
export const ChangeCompanionPreset = Schema.TaggedStruct("ChangeCompanionPreset", {
  edit: Schema.Union([
    Schema.TaggedStruct("Add", { name: PresetName, stack: Tier }),
    Schema.TaggedStruct("Rename", { name: PresetName, nextName: PresetName }),
    Schema.TaggedStruct("Delete", { name: PresetName }),
    Schema.TaggedStruct("SetStack", { name: PresetName, stack: Tier }),
  ]),
});
export type CompanionPresetEdit = typeof ChangeCompanionPreset.Type.edit;

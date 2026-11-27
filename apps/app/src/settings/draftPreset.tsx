import type { Tier } from "@outlore/contracts";
import { Text, View } from "react-native";
import { PresetChainEditor } from "../editors/presetChainEditor";
import { useHarnesses } from "../editors/runners";
import type { ServiceClient } from "../foundation/client";
import { companionStyles } from "./companionStyles";
import { savePresetEdit } from "./presetActions";
import { workshopDraft } from "./workshopDraft";
import { customFocusOf, type WorkshopFocus, type WorkshopPreset } from "./workshopTabs";

/**
 * A preset not yet made: it is edited in the same chain editor as every preset, kept as a draft, and saved under a name.
 * The tab then shows the new preset.
 */
export function DraftPreset({
  client,
  draft,
  lastPreset,
  onFocus,
}: {
  client: ServiceClient;
  draft: Tier;
  /** Where Discard returns to. */
  lastPreset: WorkshopPreset;
  onFocus: (focus: WorkshopFocus) => void;
}) {
  const { data: harnesses } = useHarnesses(client);
  return (
    <View style={companionStyles.tier}>
      <Text style={companionStyles.note}>
        New preset, not saved yet. Choose its Companions in order, then save it under a name.
      </Text>
      <PresetChainEditor
        client={client}
        harnesses={harnesses}
        isNew={true}
        name="New preset"
        onDiscard={() => onFocus(lastPreset)}
        onDraft={(next) => {
          if (next !== null) workshopDraft.set(next);
        }}
        onSave={async () => undefined}
        onSaveAs={async (name, stack) => {
          await savePresetEdit(client, { _tag: "Add", name, stack });
          onFocus(customFocusOf(name));
        }}
        stack={draft}
      />
    </View>
  );
}

import type { HarnessList, Tier } from "@outlore/contracts";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { Button } from "../ui/button";
import { PresetChainEditor } from "./presetChainEditor";
import { PresetManagement } from "./presetManagement";

/** The title row of the Companions tab's details: what they show at the left, one button at the top right. */
export function DetailsHeader({ action, title }: { action: ReactNode; title: string }) {
  return (
    <View style={local.header}>
      <Text numberOfLines={1} style={local.title}>
        {title}
      </Text>
      {action}
    </View>
  );
}

/**
 * Edit mode of the Companions tab: a saved preset's whole chain, in the same editor as the Workshop's.
 * Changes stay in a draft until Overwrite sends the preset's whole stack to `onSave`, and Discard puts the saved one back.
 * It owns no way to change the thread: that is what keeps the thread's Companion as it was.
 */
export function PresetEditor({
  harnesses,
  initial = null,
  management,
  name,
  onDone,
  onDraft,
  onSave,
  onSaveAs,
  stack,
}: {
  harnesses: HarnessList | null;
  /** The draft kept from an earlier visit to this preset. */
  initial?: Tier | null;
  /** Rename and Delete for the preset, when the thread's surface can offer them. */
  management?: { onDelete: () => Promise<unknown>; onRename: (nextName: string) => Promise<unknown> };
  name: string;
  onDone: () => void;
  onDraft?: (stack: Tier | null) => void;
  onSave: (stack: Tier) => Promise<unknown>;
  onSaveAs?: (name: string, stack: Tier) => Promise<unknown>;
  stack: Tier;
}) {
  return (
    <View style={local.body}>
      <DetailsHeader action={<Button label="Done" onPress={onDone} />} title={`Editing ${name}`} />
      <Text style={local.note}>
        Overwrite saves the chain to {name}. This thread keeps its own Companion; choose {name} again to put the edited
        preset in place.
      </Text>
      <PresetChainEditor
        harnesses={harnesses}
        initial={initial}
        name={name}
        onSave={onSave}
        stack={stack}
        {...(onDraft === undefined ? {} : { onDraft })}
        {...(onSaveAs === undefined ? {} : { onSaveAs })}
      />
      {management !== undefined && <PresetManagement name={name} {...management} />}
    </View>
  );
}

const local = StyleSheet.create({
  body: { gap: 8 },
  header: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between", minHeight: 32 },
  note: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  title: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
});

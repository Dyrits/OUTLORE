import type { HarnessList, Tier } from "@outlore/contracts";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { PresetChoice } from "../foundation/companionPickerProps";
import { colors, fontSizes, fonts, outline, radii } from "../foundation/theme";
import { PresetChainEditor } from "./presetChainEditor";
import { PresetManagement } from "./presetManagement";
import { type Preset, presetChangeOf } from "./presets";
import { ownValue } from "./useDraftStack";

/** The header row of a companion editor card: its name at the left and optional actions at the right. */
export function DetailsHeader({ action, title }: { action?: ReactNode; title: string }) {
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
 * The right-hand companion editor card: header with name and optional Rename/Delete actions, then the unified
 * collapsible chain editor.
 */
export function PresetEditor({
  harnesses,
  initial = null,
  isNew = false,
  management,
  name,
  onDiscard,
  onDraft,
  onSave,
  onSaveAs,
  stack,
}: {
  harnesses: HarnessList | null;
  /** The draft kept from an earlier visit to this companion. */
  initial?: Tier | null;
  /** Whether the stack is a new or unsaved companion. */
  isNew?: boolean;
  /** Rename and Delete for a saved companion, when the surface can offer them. */
  management?: { onDelete: () => Promise<unknown>; onRename: (nextName: string) => Promise<unknown> };
  name: string;
  onDiscard?: () => void;
  onDraft?: (stack: Tier | null) => void;
  onSave?: (stack: Tier) => Promise<unknown>;
  onSaveAs?: (name: string, stack: Tier) => Promise<unknown>;
  stack: Tier;
}) {
  return (
    <View style={local.card}>
      <DetailsHeader
        action={management !== undefined ? <PresetManagement name={name} {...management} /> : null}
        title={name}
      />
      <PresetChainEditor
        harnesses={harnesses}
        initial={initial}
        isNew={isNew}
        name={name}
        stack={stack}
        {...(onDiscard === undefined ? {} : { onDiscard })}
        {...(onDraft === undefined ? {} : { onDraft })}
        {...(onSave === undefined ? {} : { onSave })}
        {...(onSaveAs === undefined ? {} : { onSaveAs })}
      />
    </View>
  );
}

/** Chooses which companion editor card a thread's Companions tab draws: a new draft, the selected preset, or an unsaved stack. */
export function ThreadPresetCard({
  chosen,
  drafts,
  harnesses,
  isAdding,
  onCancelAdd,
  onDelete,
  onDraft,
  onRename,
  presetChoice,
  stack,
}: {
  chosen: Preset | undefined;
  drafts: Readonly<Record<string, Tier>>;
  harnesses: HarnessList | null;
  isAdding: boolean;
  onCancelAdd: () => void;
  onDelete: (name: string) => Promise<unknown>;
  onDraft: (name: string, saved: Tier, next: Tier | null) => void;
  onRename: (from: string, to: string) => Promise<unknown>;
  presetChoice: PresetChoice;
  stack: Tier;
}) {
  const { onDeletePreset, onOverwritePreset, onRenamePreset, onSavePreset } = presetChoice;
  const saveNew =
    onSavePreset === undefined
      ? undefined
      : async (nextName: string, nextStack: Tier) => {
          await onSavePreset(nextName, nextStack);
          onCancelAdd();
          presetChoice.onPreset({ backups: nextStack.backups, name: nextName, runner: nextStack });
        };
  if (isAdding) {
    return (
      <PresetEditor
        harnesses={harnesses}
        isNew={true}
        key="new-companion"
        name="New companion"
        onDiscard={onCancelAdd}
        stack={stack}
        {...(saveNew === undefined ? {} : { onSaveAs: saveNew })}
      />
    );
  }
  if (chosen === undefined) {
    return (
      <PresetEditor
        harnesses={harnesses}
        isNew={true}
        key="current-companion"
        name="Current companion"
        stack={stack}
        {...(saveNew === undefined ? {} : { onSaveAs: saveNew })}
      />
    );
  }
  const saved = presetChangeOf(chosen);
  const management =
    onRenamePreset !== undefined && onDeletePreset !== undefined
      ? {
          onDelete: () => onDelete(chosen.name),
          onRename: (nextName: string) => onRename(chosen.name, nextName),
        }
      : undefined;
  return (
    <PresetEditor
      harnesses={harnesses}
      initial={ownValue(drafts, chosen.name)}
      key={chosen.name}
      name={chosen.name}
      onDraft={(next) => onDraft(chosen.name, saved, next)}
      stack={saved}
      {...(management === undefined ? {} : { management })}
      {...(onOverwritePreset === undefined
        ? {}
        : {
            onSave: async (nextStack) => {
              await onOverwritePreset(chosen.name, nextStack);
              presetChoice.onPreset({ backups: nextStack.backups, name: chosen.name, runner: nextStack });
            },
          })}
      {...(saveNew === undefined ? {} : { onSaveAs: saveNew })}
    />
  );
}

const local = StyleSheet.create({
  card: {
    ...outline,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: 12,
    padding: 16,
  },
  header: {
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    minHeight: 34,
    paddingBottom: 12,
  },
  title: { color: colors.text, flexShrink: 1, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
});

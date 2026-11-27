import type { HarnessList, Tier } from "@outlore/contracts";
import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { Button } from "../ui/button";
import { FoldGroup } from "../ui/fold";
import { afterSaveAs, chainOf, footerOf, stackOf } from "./presetChain";
import { ChainRows } from "./presetChainRows";
import { PresetNameForm } from "./presetNameForm";
import { PresetOverwrite } from "./presetOverwrite";
import { isSameStack } from "./presets";
import type { Runner } from "./runner";
import { useDraftStack } from "./useDraftStack";

/**
 * A companion's whole stack as one ordered chain of collapsible rows, the first marked Primary: each row is named by
 * its model, account, and effort, unfolds to the pickers, and moves by its grip or its arrows.
 * Changes stay in a draft until Overwrite sends the whole stack to `onSave`; Discard puts the saved stack back;
 * leaving without either keeps the draft with the caller.
 */
export function PresetChainEditor({
  client,
  harnesses,
  initial = null,
  isNew = false,
  isPrimaryAccountShown = true,
  isSaving: isExternallySaving = false,
  name,
  onDiscard,
  onDraft,
  onSave,
  onSaveAs,
  stack,
}: {
  client?: ServiceClient;
  harnesses: HarnessList | null;
  /** A draft kept from before, which the editor starts on while the saved stack is still the one it began from. */
  initial?: Tier | null;
  /** Whether the stack is a companion not saved yet: it can only be saved under a name or discarded. */
  isNew?: boolean;
  /** Whether the primary row can choose its account; the Workshop's Default primary has none, while its backups still can. */
  isPrimaryAccountShown?: boolean;
  /** Whether an earlier save of this companion is still pending across a remount, keeping the editor locked until it settles. */
  isSaving?: boolean;
  /** What the companion is called, for the Overwrite button and question. */
  name: string;
  /** What Discard does for a new companion, which has no saved stack to go back to. */
  onDiscard?: () => void;
  /** Tells the list about the draft as it changes, so it can preview it unsaved; null once it is saved or discarded. */
  onDraft?: (stack: Tier | null) => void;
  /** Replaces the saved stack with the whole draft; omitted when the caller cannot overwrite a preset. */
  onSave?: (stack: Tier) => Promise<unknown>;
  /** Saves the draft as a new companion under a name. */
  onSaveAs?: (name: string, stack: Tier) => Promise<unknown>;
  stack: Tier;
}) {
  const { discard, edit, isChanged, shown } = useDraftStack(stack, initial);
  const [isLocalSaving, setIsLocalSaving] = useState(false);
  const isSavingRef = useRef(false);
  const isSaving = isExternallySaving || isLocalSaving;
  const chain = chainOf(shown);
  const change = (next: ReadonlyArray<Runner>) => {
    if (isSaving || isSavingRef.current) return;
    const nextStack = stackOf(next);
    if (nextStack === null) return;
    edit(nextStack);
    onDraft?.(isSameStack(nextStack, stack) ? null : nextStack);
  };
  const discardDraft = () => {
    if (isSaving || isSavingRef.current) return;
    discard();
    onDraft?.(null);
    onDiscard?.();
  };
  const runSave = async (action: () => Promise<void>) => {
    if (isExternallySaving || isSavingRef.current) return;
    isSavingRef.current = true;
    setIsLocalSaving(true);
    try {
      await action();
    } finally {
      isSavingRef.current = false;
      setIsLocalSaving(false);
    }
  };
  const footer = footerOf({
    canOverwrite: onSave !== undefined,
    canSaveAs: onSaveAs !== undefined,
    isChanged,
    isNew,
  });
  const isActionDisabled = isSaving || !footer.isDirty;
  return (
    <FoldGroup initial={null}>
      <View style={local.body}>
        <View style={local.sectionHeader}>
          <Text style={local.sectionLabel}>FALLBACK ORDER</Text>
          <Text style={local.helper}>
            The first model is tried first. When a turn fails, the next one that differs takes over. Drag a row by its
            handle to reorder.
          </Text>
        </View>
        <ChainRows
          chain={chain}
          client={client}
          harnesses={harnesses}
          isDisabled={isSaving}
          isPrimaryAccountShown={isPrimaryAccountShown}
          onChange={change}
        />
        <View style={local.footer}>
          <View style={local.footerRow}>
            <Text style={local.status}>{footer.status}</Text>
            <View style={local.footerActions}>
              <Button isDisabled={isActionDisabled} isPrimary={false} label="Discard" onPress={discardDraft} />
              {onSaveAs !== undefined && footer.canSaveAs && (
                <PresetNameForm
                  isDisabled={isActionDisabled}
                  label="Save as new"
                  onSave={(nextName) =>
                    runSave(async () => {
                      await onSaveAs(nextName, shown);
                      const outcome = afterSaveAs();
                      if (outcome.discardSource) discard();
                      onDraft?.(outcome.listDraft);
                    })
                  }
                />
              )}
            </View>
          </View>
          {footer.canOverwrite && onSave !== undefined && (
            <View style={local.overwriteRow}>
              <PresetOverwrite
                isDisabled={isActionDisabled}
                isPrimary={true}
                name={name}
                onOverwrite={() =>
                  runSave(async () => {
                    await onSave(shown);
                    onDraft?.(null);
                  })
                }
              />
            </View>
          )}
        </View>
      </View>
    </FoldGroup>
  );
}

const local = StyleSheet.create({
  body: { gap: 12 },
  footer: { borderColor: colors.border, borderTopWidth: 1, gap: 10, paddingTop: 12 },
  footerActions: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  footerRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },
  helper: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm, lineHeight: 18 },
  overwriteRow: { alignItems: "flex-start" },
  sectionHeader: { gap: 4 },
  sectionLabel: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.xs,
    fontWeight: "600",
    letterSpacing: 0.6,
  },
  status: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
});

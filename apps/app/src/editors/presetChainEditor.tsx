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
 * A preset's whole stack as one ordered chain of rows, the first the Primary Companion: each row is named by its model, account, and effort, unfolds to the pickers, and moves by its grip or its arrows.
 * Changes stay in a draft until Overwrite sends the whole stack to `onSave`; Discard puts the saved stack back; leaving without either keeps the draft with the caller. The Workshop and a thread's Companions tab both draw it, so a preset is edited one way everywhere (companion-presets, Agreed behavior).
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
  /** Whether the stack is a preset not made yet: it can only be saved under a name or discarded. */
  isNew?: boolean;
  /** Whether the primary row can choose its account; the Workshop's Default primary has none, while its backups still can. */
  isPrimaryAccountShown?: boolean;
  /** Whether an earlier save of this preset is still pending across a remount, keeping the editor locked until it settles. */
  isSaving?: boolean;
  /** What the preset is called, for the Overwrite question. */
  name: string;
  /** What Discard does for a new preset, which has no saved stack to go back to. */
  onDiscard?: () => void;
  /** Tells the list of presets about the draft as it changes, so it can show it unsaved; null once it is saved or discarded. */
  onDraft?: (stack: Tier | null) => void;
  /** Replaces the saved stack with the whole draft. */
  onSave: (stack: Tier) => Promise<unknown>;
  /** Saves the draft as a new preset under a name. */
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
  const footer = footerOf({ canSaveAs: onSaveAs !== undefined, isChanged, isNew });
  return (
    <FoldGroup initial="chain-0">
      <View style={local.body}>
        <ChainRows
          chain={chain}
          client={client}
          harnesses={harnesses}
          isDisabled={isSaving}
          isPrimaryAccountShown={isPrimaryAccountShown}
          onChange={change}
        />
        <View style={local.footer}>
          <Text style={local.status}>{footer.status}</Text>
          {footer.hasControls && (
            <>
              {footer.canOverwrite && (
                <PresetOverwrite
                  isDisabled={isSaving}
                  name={name}
                  onOverwrite={() =>
                    runSave(async () => {
                      await onSave(shown);
                      onDraft?.(null);
                    })
                  }
                />
              )}
              {onSaveAs !== undefined && footer.canSaveAs && (
                <PresetNameForm
                  isDisabled={isSaving}
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
              <Button isDisabled={isSaving} isPrimary={false} label="Discard" onPress={discardDraft} />
            </>
          )}
        </View>
      </View>
    </FoldGroup>
  );
}

const local = StyleSheet.create({
  body: { gap: 10 },
  footer: { gap: 8 },
  status: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
});

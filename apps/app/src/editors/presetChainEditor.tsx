import type { HarnessList, Tier } from "@outlore/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { Button } from "../ui/button";
import { Fold, FoldGroup, useFoldState, useOpenFold } from "../ui/fold";
import { SortableItem } from "../ui/sortable";
import {
  afterSaveAs,
  appendedTo,
  chainLabelOf,
  chainOf,
  footerOf,
  maxChain,
  movedIn,
  newRunnerOf,
  openAfterMove,
  openAfterRemove,
  removedFrom,
  replacedIn,
  stackOf,
} from "./presetChain";
import { PresetNameForm } from "./presetNameForm";
import { PresetOverwrite } from "./presetOverwrite";
import { isSameStack } from "./presets";
import type { Runner } from "./runner";
import { RunnerPickers } from "./runners";
import { useDraftStack } from "./useDraftStack";

/** The row's own controls: move up, move down, and Remove, named by the row's place. */
function RowControls({
  count,
  index,
  onMove,
  onRemove,
}: {
  count: number;
  index: number;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const place = index + 1;
  return (
    <View style={local.controls}>
      <Pressable
        accessibilityLabel={`Move companion ${place} up`}
        accessibilityRole="button"
        disabled={index === 0}
        onPress={() => onMove(index - 1)}
      >
        <Text style={[local.control, index === 0 && local.controlOff]}>↑</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={`Move companion ${place} down`}
        accessibilityRole="button"
        disabled={index === count - 1}
        onPress={() => onMove(index + 1)}
      >
        <Text style={[local.control, index === count - 1 && local.controlOff]}>↓</Text>
      </Pressable>
      {count > 1 && (
        <Pressable accessibilityLabel={`Remove companion ${place}`} accessibilityRole="button" onPress={onRemove}>
          <Text style={local.remove}>Remove</Text>
        </Pressable>
      )}
    </View>
  );
}

/** The add button, which unfolds the row it adds. */
function AddRow({ count, onAdd }: { count: number; onAdd: () => void }) {
  const openFold = useOpenFold();
  if (count >= maxChain) return <Text style={styles.muted}>The most is {maxChain}.</Text>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        onAdd();
        openFold(`chain-${count}`);
      }}
    >
      <Text style={local.add}>+ Add a model</Text>
    </Pressable>
  );
}

/** The chain's rows and the button that adds one; the unfolded row stays with its Companion when rows move or go. */
function ChainRows({
  chain,
  client,
  harnesses,
  isAccountShown,
  onChange,
}: {
  chain: ReadonlyArray<Runner>;
  client: ServiceClient | undefined;
  harnesses: HarnessList | null;
  isAccountShown: boolean;
  onChange: (next: ReadonlyArray<Runner>) => void;
}) {
  const { open, setOpen } = useFoldState();
  const move = (from: number, to: number) => {
    onChange(movedIn(chain, from, to));
    setOpen(openAfterMove(open, from, to));
  };
  const remove = (index: number) => {
    onChange(removedFrom(chain, index));
    setOpen(openAfterRemove(open, index));
  };
  return (
    <View style={local.list}>
      {chain.map((runner, index) => (
        // A Companion has no identity but its place in the chain.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <SortableItem index={index} key={index} onMove={move}>
          {(grip) => (
            <Fold
              grip={grip}
              harness={runner.harness}
              id={`chain-${index}`}
              isSummaryFixed={true}
              summary={index === 0 ? "Primary" : `Order ${index + 1}`}
              title={chainLabelOf(harnesses, runner)}
            >
              <RowControls
                count={chain.length}
                index={index}
                onMove={(to) => move(index, to)}
                onRemove={() => remove(index)}
              />
              <RunnerPickers
                {...(client === undefined ? {} : { client })}
                harnesses={harnesses}
                isAccountShown={isAccountShown}
                isCompact={false}
                isPanel={true}
                // The pickers keep their own tab choice, so a row that now holds another Companion starts them again.
                key={`${runner.harness}:${runner.accountId}:${runner.model}`}
                onChange={(next) => onChange(replacedIn(chain, index, next))}
                value={runner}
              />
            </Fold>
          )}
        </SortableItem>
      ))}
      <AddRow count={chain.length} onAdd={() => onChange(appendedTo(chain, newRunnerOf(harnesses, isAccountShown)))} />
    </View>
  );
}

/**
 * A preset's whole stack as one ordered chain of rows, the first the Primary Companion: each row is named by its model, account, and effort, unfolds to the pickers, and moves by its grip or its arrows.
 * Changes stay in a draft until Overwrite sends the whole stack to `onSave`; Discard puts the saved stack back; leaving without either keeps the draft with the caller. The Workshop and a thread's Companions tab both draw it, so a preset is edited one way everywhere (companion-presets, Agreed behavior).
 */
export function PresetChainEditor({
  client,
  harnesses,
  isAccountShown = true,
  initial = null,
  isNew = false,
  name,
  onDiscard,
  onDraft,
  onSave,
  onSaveAs,
  stack,
}: {
  client?: ServiceClient;
  harnesses: HarnessList | null;
  /** Whether a row can choose its account; the Workshop's defaults have none. */
  isAccountShown?: boolean;
  /** A draft kept from before, which the editor starts on while the saved stack is still the one it began from. */
  initial?: Tier | null;
  /** Whether the stack is a preset not made yet: it can only be saved under a name or discarded. */
  isNew?: boolean;
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
  const chain = chainOf(shown);
  const change = (next: ReadonlyArray<Runner>) => {
    const nextStack = stackOf(next);
    if (nextStack === null) return;
    edit(nextStack);
    onDraft?.(isSameStack(nextStack, stack) ? null : nextStack);
  };
  const discardDraft = () => {
    discard();
    onDraft?.(null);
    onDiscard?.();
  };
  const footer = footerOf({ canSaveAs: onSaveAs !== undefined, isChanged, isNew });
  return (
    <FoldGroup initial="chain-0">
      <View style={local.body}>
        <ChainRows
          chain={chain}
          client={client}
          harnesses={harnesses}
          isAccountShown={isAccountShown}
          onChange={change}
        />
        <View style={local.footer}>
          <Text style={local.status}>{footer.status}</Text>
          {footer.hasControls && (
            <>
              {footer.canOverwrite && (
                <PresetOverwrite
                  name={name}
                  onOverwrite={async () => {
                    await onSave(shown);
                    onDraft?.(null);
                  }}
                />
              )}
              {onSaveAs !== undefined && footer.canSaveAs && (
                <PresetNameForm
                  label="Save as new"
                  onSave={async (nextName) => {
                    await onSaveAs(nextName, shown);
                    const outcome = afterSaveAs();
                    if (outcome.discardSource) discard();
                    onDraft?.(outcome.listDraft);
                  }}
                />
              )}
              <Button isPrimary={false} label="Discard" onPress={discardDraft} />
            </>
          )}
        </View>
      </View>
    </FoldGroup>
  );
}

const local = StyleSheet.create({
  add: { color: colors.accentText, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "500" },
  body: { gap: 10 },
  control: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, paddingHorizontal: 4 },
  controlOff: { color: colors.textMuted, opacity: 0.4 },
  controls: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  footer: { gap: 8 },
  list: { gap: 8 },
  remove: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "500" },
  status: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
});

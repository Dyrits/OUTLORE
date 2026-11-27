import type { HarnessList } from "@outlore/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { Fold, useFoldState, useOpenFold } from "../ui/fold";
import { SortableItem } from "../ui/sortable";
import {
  appendedTo,
  canMoveIn,
  canRemoveAt,
  chainLabelOf,
  maxChain,
  movedIn,
  newRunnerOf,
  openAfterMove,
  openAfterRemove,
  removedFrom,
  replacedIn,
} from "./presetChain";
import type { Runner } from "./runner";
import { RunnerPickers } from "./runners";

/** The row's own controls: move up, move down, and Remove, named by the row's place. */
function RowControls({
  canDown,
  canRemove,
  canUp,
  index,
  isDisabled,
  onMove,
  onRemove,
}: {
  canDown: boolean;
  canRemove: boolean;
  canUp: boolean;
  index: number;
  isDisabled: boolean;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const place = index + 1;
  return (
    <View style={local.controls}>
      <Pressable
        accessibilityLabel={`Move companion ${place} up`}
        accessibilityRole="button"
        disabled={isDisabled || !canUp}
        onPress={() => onMove(index - 1)}
      >
        <Text style={[local.control, (isDisabled || !canUp) && local.controlOff]}>↑</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={`Move companion ${place} down`}
        accessibilityRole="button"
        disabled={isDisabled || !canDown}
        onPress={() => onMove(index + 1)}
      >
        <Text style={[local.control, (isDisabled || !canDown) && local.controlOff]}>↓</Text>
      </Pressable>
      {canRemove && (
        <Pressable
          accessibilityLabel={`Remove companion ${place}`}
          accessibilityRole="button"
          disabled={isDisabled}
          onPress={onRemove}
        >
          <Text style={[local.remove, isDisabled && local.controlOff]}>Remove</Text>
        </Pressable>
      )}
    </View>
  );
}

/** The add button, which unfolds the row it adds. */
function AddRow({ count, isDisabled, onAdd }: { count: number; isDisabled: boolean; onAdd: () => void }) {
  const openFold = useOpenFold();
  if (count >= maxChain) return <Text style={styles.muted}>The most is {maxChain}.</Text>;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={() => {
        onAdd();
        openFold(`chain-${count}`);
      }}
    >
      <Text style={[local.add, isDisabled && local.controlOff]}>+ Add a model</Text>
    </Pressable>
  );
}

/** The chain's rows and the button that adds one; the unfolded row stays with its Companion when rows move or go. */
export function ChainRows({
  chain,
  client,
  harnesses,
  isDisabled,
  isPrimaryAccountShown,
  onChange,
}: {
  chain: ReadonlyArray<Runner>;
  client: ServiceClient | undefined;
  harnesses: HarnessList | null;
  isDisabled: boolean;
  isPrimaryAccountShown: boolean;
  onChange: (next: ReadonlyArray<Runner>) => void;
}) {
  const { open, setOpen } = useFoldState();
  const move = (from: number, to: number) => {
    if (isDisabled || !canMoveIn(chain, from, to, isPrimaryAccountShown)) return;
    onChange(movedIn(chain, from, to));
    setOpen(openAfterMove(open, from, to));
  };
  const remove = (index: number) => {
    if (isDisabled || !canRemoveAt(chain, index, isPrimaryAccountShown)) return;
    onChange(removedFrom(chain, index));
    setOpen(openAfterRemove(open, index));
  };
  return (
    <View pointerEvents={isDisabled ? "none" : "auto"} style={local.list}>
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
                canDown={canMoveIn(chain, index, index + 1, isPrimaryAccountShown)}
                canRemove={canRemoveAt(chain, index, isPrimaryAccountShown)}
                canUp={canMoveIn(chain, index, index - 1, isPrimaryAccountShown)}
                index={index}
                isDisabled={isDisabled}
                onMove={(to) => move(index, to)}
                onRemove={() => remove(index)}
              />
              <RunnerPickers
                {...(client === undefined ? {} : { client })}
                harnesses={harnesses}
                isAccountShown={index === 0 ? isPrimaryAccountShown : true}
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
      <AddRow
        count={chain.length}
        isDisabled={isDisabled}
        onAdd={() => onChange(appendedTo(chain, newRunnerOf(harnesses, true)))}
      />
    </View>
  );
}

const local = StyleSheet.create({
  add: { color: colors.accentText, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "500" },
  control: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, paddingHorizontal: 4 },
  controlOff: { color: colors.textMuted, opacity: 0.4 },
  controls: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  list: { gap: 8 },
  remove: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "500" },
});

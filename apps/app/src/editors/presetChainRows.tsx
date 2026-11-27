import type { HarnessList } from "@outlore/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, outline, radii, round } from "../foundation/theme";
import { useFoldState, useOpenFold } from "../ui/fold";
import { FoldChevron } from "../ui/foldChevron";
import { handCursor } from "../ui/pointer";
import { ProviderMark } from "../ui/providerMarks";
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

/** Keyboard-accessible reorder buttons inside an unfolded row. */
function MoveControls({
  canDown,
  canUp,
  index,
  isDisabled,
  onMove,
}: {
  canDown: boolean;
  canUp: boolean;
  index: number;
  isDisabled: boolean;
  onMove: (to: number) => void;
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
    </View>
  );
}

/** The dashed add button at the bottom of the chain, which unfolds the row it adds. */
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
      style={({ pressed }) => [local.addButton, pressed && !isDisabled && local.pressed]}
    >
      <Text style={[local.add, isDisabled && local.controlOff]}>+ Add a model</Text>
    </Pressable>
  );
}

/** The chain's collapsible, draggable rows and the button that adds one; the unfolded row follows its Companion when rows move or go. */
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
      {chain.map((runner, index) => {
        const id = `chain-${index}`;
        const isOpen = open === id;
        const label = chainLabelOf(harnesses, runner);
        const canRemove = canRemoveAt(chain, index, isPrimaryAccountShown);
        const toggle = () => setOpen(isOpen ? null : id);
        return (
          // A Companion has no identity but its place in the chain.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <SortableItem index={index} key={index} onMove={move}>
            {(grip) => (
              <View style={[local.rowCard, isOpen && local.rowCardOpen]}>
                <View style={local.rowHeader}>
                  {grip}
                  <Pressable
                    accessibilityLabel={label}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    onPress={toggle}
                    style={({ pressed }) => [local.rowToggle, pressed && local.rowPressed]}
                  >
                    <View style={local.indexBadge}>
                      <Text style={local.indexText}>{index + 1}</Text>
                    </View>
                    <Text numberOfLines={1} style={local.title}>
                      {label}
                    </Text>
                    {index === 0 && (
                      <View style={local.primaryBadge}>
                        <Text style={local.primaryText}>Primary</Text>
                      </View>
                    )}
                    <View style={local.spacer} />
                    <ProviderMark harness={runner.harness} size={15} />
                  </Pressable>
                  {canRemove && (
                    <Pressable
                      accessibilityLabel={`Remove companion ${index + 1}`}
                      accessibilityRole="button"
                      disabled={isDisabled}
                      hitSlop={6}
                      onPress={() => remove(index)}
                      style={({ pressed }) => [local.iconButton, pressed && local.rowPressed]}
                    >
                      <Text style={[local.removeIcon, isDisabled && local.controlOff]}>✕</Text>
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityLabel={isOpen ? `Collapse ${label}` : `Expand ${label}`}
                    accessibilityRole="button"
                    hitSlop={6}
                    onPress={toggle}
                    style={({ pressed }) => [local.iconButton, pressed && local.rowPressed]}
                  >
                    <FoldChevron color={colors.textMuted} isOpen={isOpen} size={14} />
                  </Pressable>
                </View>
                {isOpen && (
                  <View style={local.rowBody}>
                    <MoveControls
                      canDown={canMoveIn(chain, index, index + 1, isPrimaryAccountShown)}
                      canUp={canMoveIn(chain, index, index - 1, isPrimaryAccountShown)}
                      index={index}
                      isDisabled={isDisabled}
                      onMove={(to) => move(index, to)}
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
                  </View>
                )}
              </View>
            )}
          </SortableItem>
        );
      })}
      <AddRow
        count={chain.length}
        isDisabled={isDisabled}
        onAdd={() => onChange(appendedTo(chain, newRunnerOf(harnesses, true)))}
      />
    </View>
  );
}

const local = StyleSheet.create({
  add: { color: colors.accentText, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
  addButton: {
    alignItems: "center",
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderStyle: "dashed",
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...handCursor,
  },
  control: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, paddingHorizontal: 4 },
  controlOff: { color: colors.textMuted, opacity: 0.4 },
  controls: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 4,
    ...handCursor,
  },
  indexBadge: {
    alignItems: "center",
    backgroundColor: colors.controlActive,
    borderRadius: radii.pill,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  indexText: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 11, fontWeight: "600" },
  list: { gap: 8 },
  pressed: { backgroundColor: colors.controlHover },
  primaryBadge: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  primaryText: { color: colors.accentText, fontFamily: fonts.sans, fontSize: fontSizes.xs, fontWeight: "600" },
  removeIcon: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "600" },
  rowBody: { borderColor: colors.border, borderTopWidth: 1, gap: 8, padding: 12 },
  rowCard: { ...outline, ...round, backgroundColor: colors.surface, overflow: "hidden" },
  rowCardOpen: { backgroundColor: colors.page },
  rowHeader: { alignItems: "center", flexDirection: "row", gap: 6, minHeight: 42, paddingHorizontal: 10 },
  rowPressed: { opacity: 0.8 },
  rowToggle: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minWidth: 0,
    paddingVertical: 8,
    ...handCursor,
  },
  spacer: { flex: 1 },
  title: { color: colors.text, flexShrink: 1, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
});

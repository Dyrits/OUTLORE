import { type ReactElement, useContext, useEffect, useId, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CompanionPickerProps } from "../foundation/companionPickerProps";
import { effortName, modelLabelOf, runnerSummaryOf } from "../foundation/formatting";
import { CompanionDockActions, CompanionTabOf } from "../foundation/shellContext";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { Fold, FoldGroup } from "../ui/fold";
import { ProviderMark } from "../ui/providerMarks";
import { CompanionBody } from "./companionBody";
import { chainLabelOf } from "./presetChain";
import { PresetChooser } from "./presetChooser";
import { ThreadPresetCard } from "./presetEditor";
import { entriesOf, panelLayoutOf, splitGap } from "./presetEntries";
import { presetChangeOf } from "./presets";
import { type KeptDrafts, keptRenamed, keptWith, keptWithout, liveDraftsOf } from "./useDraftStack";

/** The width of the picker's panel in a window with no right-hand column to hold it: a mini sidebar. */
const miniWidth = 288;

/**
 * The Companions tab: balanced two-column layout when wide enough (`splitLeastWidth`), stacked when narrow.
 * Left column lists each saved companion card with its numbered fallback chain plus "+ Add a companion".
 * Right column is the unified chain editor for the selected companion (or a new/unsaved companion draft).
 */
export function CompanionPanel({ onClose, ...props }: CompanionPickerProps & { onClose?: () => void }) {
  const { extra, panel, ...picker } = props;
  const { presetChoice = null } = picker;
  const onSavePreset = presetChoice?.onSavePreset;
  const backups = presetChoice?.backups;
  const [isAdding, setIsAdding] = useState(false);
  // Each companion's unsaved chain, kept until it is saved or discarded and previewed on its card at once.
  const [kept, setKept] = useState<KeptDrafts>({});
  const [width, setWidth] = useState<number | null>(null);
  const layout = panelLayoutOf(width);
  const stack =
    backups == null
      ? null
      : { accountId: props.accountId, backups, effort: props.effort, harness: props.harness, model: props.model };
  const presets = presetChoice?.presets ?? [];
  const entries = entriesOf(presets, stack);
  const chosen = entries.find((entry) => entry.isChosen)?.preset;
  const drafts = liveDraftsOf(kept, (name) => {
    const found = presets.find((preset) => preset.name === name);
    return found === undefined ? null : presetChangeOf(found);
  });
  const isSplit = layout === "split";
  const hasList = presetChoice !== null && (entries.length > 0 || onSavePreset !== undefined);
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[local.body, panel !== undefined && local.bodyOfPanel]}
    >
      {onClose !== undefined && (
        <View style={local.title}>
          <Text style={local.titleText}>Companions</Text>
          <Pressable accessibilityLabel="Close the menu" accessibilityRole="button" onPress={onClose}>
            <Text style={local.titleClose}>✕</Text>
          </Pressable>
        </View>
      )}
      <ScrollView contentContainerStyle={[local.stack, isSplit && hasList && local.split]} style={local.scroll}>
        {panel ??
          (presetChoice !== null && stack !== null ? (
            <>
              {hasList && (
                <View style={isSplit && local.nav}>
                  <PresetChooser
                    drafts={drafts}
                    entries={entries}
                    harnesses={props.harnesses}
                    isAdding={isAdding}
                    isChainListed={true}
                    onPreset={(preset) => {
                      setIsAdding(false);
                      presetChoice.onPreset(preset);
                    }}
                    {...(onSavePreset === undefined ? {} : { onAdd: () => setIsAdding(true) })}
                  />
                </View>
              )}
              <View style={[local.details, isSplit && hasList && local.detailsSplit]}>
                <ThreadPresetCard
                  chosen={chosen}
                  drafts={drafts}
                  harnesses={props.harnesses}
                  isAdding={isAdding}
                  onCancelAdd={() => setIsAdding(false)}
                  onDelete={async (name) => {
                    await presetChoice.onDeletePreset?.(name);
                    setKept((current) => keptWithout(current, name));
                  }}
                  onDraft={(name, saved, next) => setKept((current) => keptWith(current, name, saved, next))}
                  onRename={async (from, to) => {
                    await presetChoice.onRenamePreset?.(from, to);
                    setKept((current) => keptRenamed(current, from, to));
                  }}
                  presetChoice={presetChoice}
                  stack={stack}
                />
              </View>
            </>
          ) : (
            <FoldGroup initial="main">
              <View style={local.details}>
                <Fold
                  harness={picker.harness}
                  id="main"
                  summary={runnerSummaryOf(picker.harnesses, picker)}
                  title={chainLabelOf(picker.harnesses, picker)}
                >
                  <CompanionBody {...picker} />
                </Fold>
                {extra}
              </View>
            </FoldGroup>
          ))}
      </ScrollView>
    </View>
  );
}

/**
 * One button for a whole runner, as in a composer: the harness's logo, the Companion, and the effort. In a window with
 * a right-hand column it opens that column on its Companion tab, beside the quest's tab, and hands it the picker's
 * state; in a narrow window, with no such column, it opens the picker as a panel over the window's right edge.
 */
export function CompanionPicker({
  isTabOpen = false,
  onDismiss,
  onOpenTab,
  rank = 0,
  trigger,
  ...props
}: CompanionPickerProps & {
  /** Whether the composer's own pane shows the Companions tab; the button is then selected, and pressing it leaves. */
  isTabOpen?: boolean;
  /** Runs when the narrow overlay is closed by its button, backdrop, or native dismiss. */
  onDismiss?: (() => void) | undefined;
  /** Opens the Companions tab in the composer’s own pane, or leaves it when it is shown. */
  onOpenTab?: (() => void) | undefined;
  rank?: number;
  /** Another control in place of the runner button, such as a card's "Change"; it opens and closes the same tab. */
  trigger?: (control: { isOpen: boolean; onPress: () => void }) => ReactElement;
}) {
  const { harness, harnesses, model } = props;
  const id = useId();
  const dock = useContext(CompanionDockActions);
  const shownFor = useContext(CompanionTabOf);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const { publish, register, unregister } = dock ?? {};
  useEffect(() => {
    register?.(id);
    return () => unregister?.(id);
  }, [id, register, unregister]);
  // After every render, so the tab shows the runner as it is now.
  useEffect(() => publish?.(id, props, rank));
  const isOpen = onOpenTab !== undefined ? isTabOpen : dock === null ? isOverlayOpen : shownFor === id;
  const currentLabel = modelLabelOf(
    model,
    harnesses?.harnesses.find((candidate) => candidate.name === harness)?.models,
  );
  const press = onOpenTab ?? (() => (dock === null ? setIsOverlayOpen(!isOverlayOpen) : dock.open(id)));
  const closeOverlay = () => {
    setIsOverlayOpen(false);
    onDismiss?.();
  };
  return (
    <View style={[styles.menu, trigger !== undefined && local.triggerFrame]}>
      {trigger === undefined ? (
        <Pressable
          accessibilityLabel="Companion (model)"
          accessibilityRole="button"
          onPress={press}
          style={[styles.menuButton, local.trigger, isOpen && styles.menuButtonOpen]}
        >
          <ProviderMark harness={harness} size={14} />
          <Text numberOfLines={1} style={local.triggerText}>
            {currentLabel}
          </Text>
          {/* The effort is always named, so a Default effort still shows the picker sets one. */}
          <Text style={local.triggerEffort}>{effortName(props.effort)}</Text>
          <Text style={styles.menuCaret}>⌄</Text>
        </Pressable>
      ) : (
        trigger({ isOpen, onPress: press })
      )}
      {dock === null && onOpenTab === undefined && (
        <Modal animationType="none" onRequestClose={closeOverlay} transparent visible={isOverlayOpen}>
          <Pressable accessibilityLabel="Close the menu" onPress={closeOverlay} style={StyleSheet.absoluteFill} />
          <View style={local.overlay}>
            <CompanionPanel {...props} onClose={closeOverlay} />
          </View>
        </Modal>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  body: { backgroundColor: colors.page, flex: 1, gap: 8, padding: 12 },
  // A panel of its own starts with tabs, which sit closer to the column's.
  bodyOfPanel: { paddingTop: 6 },
  details: { gap: 12 },
  detailsSplit: { flex: 1, minWidth: 0 },
  nav: { flex: 1, minWidth: 0 },
  // A narrow window's stand-in for the column: a panel over the right edge, below the top bar.
  overlay: {
    borderColor: colors.border,
    borderLeftWidth: 1,
    bottom: 0,
    position: "absolute",
    right: 0,
    top: 40,
    width: miniWidth,
  },
  scroll: { flex: 1 },
  split: { alignItems: "flex-start", flexDirection: "row", gap: splitGap },
  stack: { gap: 12 },
  title: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  titleClose: { color: colors.textMuted, fontSize: fontSizes.md, paddingHorizontal: 4 },
  titleText: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.xs, fontWeight: "600" },
  trigger: { gap: 6 },
  triggerEffort: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  // A control of the caller's own may fill the frame it is placed in.
  triggerFrame: { flexGrow: 1 },
  triggerText: {
    color: colors.textSecondary,
    flexShrink: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    fontWeight: "500",
  },
});

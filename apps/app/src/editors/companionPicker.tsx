import { type ReactElement, useContext, useEffect, useId, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CompanionPickerProps } from "../foundation/companionPickerProps";
import { effortName, modelLabelOf } from "../foundation/formatting";
import { CompanionDockActions, CompanionTabOf } from "../foundation/shellContext";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { FoldGroup } from "../ui/fold";
import { ProviderMark } from "../ui/providerMarks";
import { PresetChooser } from "./presetChooser";
import { detailsModeOf, entriesOf, navWidth, panelLayoutOf, splitGap } from "./presetEntries";
import { presetChangeOf } from "./presets";
import { ThreadCompanionDetails } from "./threadCompanionDetails";
import { ThreadPresetEditor } from "./threadPresetEditor";
import { type KeptDrafts, keptRenamed, keptWith, keptWithout, liveDraftsOf } from "./useDraftStack";

/** The width of the picker's panel in a window with no right-hand column to hold it: a mini sidebar. */
const miniWidth = 288;

/**
 * The Companions tab: the presets when there are any (a list of rows, then a Custom entry for a stack none of them holds), then a fold for the thread's own Companion, unfolded first, and under it what belongs to the thread alone (`extra`: its backup Companions, one fold each).
 * One fold is unfolded at a time.
 * Wide enough (`splitLeastWidth`, measured on the panel itself), the list stands at the left and the details at the right; narrower, they are stacked.
 * Edit on a selected preset swaps the details for the preset's own editors (edit mode), which change the preset and never the thread.
 */
export function CompanionPanel({ onClose, ...props }: CompanionPickerProps & { onClose?: () => void }) {
  const { extra, panel, ...picker } = props;
  const { presetChoice = null } = picker;
  const onSavePreset = presetChoice?.onSavePreset;
  const onOverwritePreset = presetChoice?.onOverwritePreset;
  const backups = presetChoice?.backups;
  // The preset last chosen in this tab: what a changed Companion can be written back to.
  const [basedOn, setBasedOn] = useState<string | null>(null);
  // The preset in edit mode, by name.
  const [editing, setEditing] = useState<string | null>(null);
  // Each preset's unsaved chain from edit mode, kept until it is saved or discarded and shown in the list at once.
  const [kept, setKept] = useState<KeptDrafts>({});
  const [width, setWidth] = useState<number | null>(null);
  const layout = panelLayoutOf(width);
  const stack =
    backups == null
      ? null
      : { accountId: props.accountId, backups, effort: props.effort, harness: props.harness, model: props.model };
  const presets = presetChoice?.presets ?? [];
  const entries = entriesOf(presets, stack);
  const chosen = entries.find((entry) => entry.kind === "preset" && entry.isChosen);
  const isCustomStack = entries.some((entry) => entry.kind === "custom");
  const overwritten = presets.find((preset) => preset.name === basedOn);
  const details = detailsModeOf(presets, editing);
  const drafts = liveDraftsOf(kept, (name) => {
    const found = presets.find((preset) => preset.name === name);
    return found === undefined ? null : presetChangeOf(found);
  });
  const isSplit = layout === "split";
  return (
    <FoldGroup initial="main">
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
        <ScrollView contentContainerStyle={[local.stack, isSplit && local.split]} style={local.scroll}>
          {panel ?? (
            <>
              {presetChoice !== null && entries.length > 0 && (
                <View style={isSplit && local.nav}>
                  <PresetChooser
                    drafts={drafts}
                    editing={details.mode === "edit" ? details.preset.name : null}
                    entries={entries}
                    harnesses={props.harnesses}
                    isChainListed={true}
                    isNav={isSplit}
                    onPreset={(preset) => {
                      setBasedOn(preset.name);
                      // Choosing a preset is a handover of the thread, which ends the edit of a preset.
                      setEditing(null);
                      presetChoice.onPreset(preset);
                    }}
                  />
                </View>
              )}
              <View style={[local.details, isSplit && entries.length > 0 && local.detailsSplit]}>
                {details.mode === "edit" && presetChoice !== null && onOverwritePreset !== undefined ? (
                  <ThreadPresetEditor
                    choice={{
                      ...presetChoice,
                      ...(presetChoice.onRenamePreset === undefined
                        ? {}
                        : {
                            onRenamePreset: async (from: string, to: string) => {
                              await presetChoice.onRenamePreset?.(from, to);
                              setKept((current) => keptRenamed(current, from, to));
                            },
                          }),
                      ...(presetChoice.onDeletePreset === undefined
                        ? {}
                        : {
                            onDeletePreset: async (name: string) => {
                              await presetChoice.onDeletePreset?.(name);
                              setKept((current) => keptWithout(current, name));
                            },
                          }),
                    }}
                    harnesses={props.harnesses}
                    initial={drafts[details.preset.name] ?? null}
                    key={details.preset.name}
                    onDraft={(next) =>
                      setKept((current) => keptWith(current, details.preset.name, presetChangeOf(details.preset), next))
                    }
                    onEditing={setEditing}
                    onOverwrite={onOverwritePreset}
                    preset={details.preset}
                  />
                ) : (
                  <ThreadCompanionDetails
                    backups={backups}
                    chosen={chosen}
                    entriesCount={entries.length}
                    extra={extra}
                    isCustomStack={isCustomStack}
                    onEdit={setEditing}
                    onOverwritePreset={onOverwritePreset}
                    onSavePreset={onSavePreset}
                    overwritten={overwritten}
                    picker={picker}
                    stack={stack}
                  />
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </FoldGroup>
  );
}

/**
 * One button for a whole runner, as in a composer: the harness's logo, the Companion, and the effort. In a window with
 * a right-hand column it opens that column on its Companion tab, beside the quest's tab, and hands it the picker's
 * state; in a narrow window, with no such column, it opens the picker as a panel over the window's right edge.
 */
export function CompanionPicker({
  isTabOpen = false,
  onOpenTab,
  rank = 0,
  trigger,
  ...props
}: CompanionPickerProps & {
  /** Whether the composer's own pane shows the Companions tab; the button is then selected, and pressing it leaves. */
  isTabOpen?: boolean;
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
        <Modal animationType="none" onRequestClose={() => setIsOverlayOpen(false)} transparent visible={isOverlayOpen}>
          <Pressable
            accessibilityLabel="Close the menu"
            onPress={() => setIsOverlayOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={local.overlay}>
            <CompanionPanel {...props} onClose={() => setIsOverlayOpen(false)} />
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
  // The details stand under the list when stacked, and beside it when split; the Overwrite and save forms keep their 8 px.
  details: { gap: 8 },
  detailsSplit: { flex: 1, minWidth: 0 },
  nav: { width: navWidth },
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
  stack: { gap: 8 },
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

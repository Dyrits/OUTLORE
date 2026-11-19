import { type ReactNode, useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { CompanionPanel } from "../editors/companionPicker";
import { colors, radii } from "../foundation/theme";
import type { RightPanel } from "../foundation/useRightPanel";
import { EdgeResizer } from "./edgeResizer";
import { isQuestTabOpen, panelAfterQuestIcon } from "./questTab";
import { clampPaneWidth, questPanelWidthKey, readPaneWidth, rememberPaneWidth } from "./railStorage";
import { type DetailsToggle, QuestColumn, questColumnWidth } from "./topBar";
import { useCompanionDock } from "./useCompanionDock";

/**
 * The details panel, the column at the window's right with the Quest and Companions tabs (the specification keeps it
 * there beside the panes): what it holds, whether it shows, how wide it is, and the buttons that open it. Chronicler's
 * state decides which Companion it offers, so the frame passes it in.
 */
export function useDetailsColumn(input: {
  details: DetailsToggle | null;
  hasRail: boolean;
  isChroniclerFull: boolean;
  isChroniclerOpen: boolean;
  /** The quest open in the window; its own header has the panel's icon, so the round handle on the edge is left out. */
  isQuestOpen: boolean;
  rightPanel: RightPanel;
}) {
  const { details, hasRail, isChroniclerFull, isChroniclerOpen, isQuestOpen, rightPanel } = input;
  const { width } = useWindowDimensions();
  const [storedWidth, setStoredWidth] = useState(() => readPaneWidth(questPanelWidthKey, questColumnWidth));
  const questWidth = clampPaneWidth(storedWidth, width, questColumnWidth);
  const [questPanel, setQuestPanel] = useState<ReactNode>(null);
  const [panelTitle, setPanelTitle] = useState("Quest");
  const setPanel = useCallback((panel: ReactNode, title: string) => {
    setQuestPanel(panel);
    setPanelTitle(title);
  }, []);
  const isPanelShown = !isChroniclerFull && details?.isOpen === true && questPanel !== null;
  const edge = (
    <EdgeResizer
      label="Resize the quest panel"
      leastWidth={questColumnWidth}
      onChange={setStoredWidth}
      onRelease={(next) => rememberPaneWidth(questPanelWidthKey, next)}
      side="start"
      width={questWidth}
      windowWidth={width}
    />
  );
  const panelColumn = isPanelShown && details !== null && (
    <QuestColumn
      edge={edge}
      isWide={hasRail}
      onClose={details.isPinned === true ? null : details.onToggle}
      title={panelTitle}
      width={questWidth}
    >
      {questPanel}
    </QuestColumn>
  );
  const companions = useCompanionDock(rightPanel, isChroniclerFull, isChroniclerOpen);
  const { companionPicker, dock, hasCompanion, isCompanionShown, otherPillId, pillId } = companions;
  const hasQuestPanel = !isChroniclerFull && details !== null && questPanel !== null;
  const activeTab = rightPanel.content?.tab ?? "quest";
  const isColumnOpen = isCompanionShown || (hasQuestPanel && details.isOpen);
  const isQuestTabShown = isQuestTabOpen({ activeTab, hasQuestPanel, isColumnOpen });
  const questTabButton = hasQuestPanel
    ? { isOpen: isQuestTabShown, onPress: () => rightPanel.show(panelAfterQuestIcon(isQuestTabShown)) }
    : null;
  const hasEdgeHandle = hasQuestPanel ? details.isPinned !== true && !isQuestOpen : hasCompanion;
  const toggleColumn = () => {
    if (isColumnOpen) rightPanel.show(null);
    else if (hasQuestPanel) rightPanel.show({ tab: "quest" });
    else if (pillId !== null) dock.choose(pillId);
  };
  const tabs = (
    <View style={local.tabs}>
      {hasQuestPanel && (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "quest" }}
          onPress={() => rightPanel.show({ tab: "quest" })}
          style={[local.tab, activeTab === "quest" && local.tabActive]}
        >
          <Text style={[local.tabText, activeTab === "quest" && local.tabTextActive]}>{panelTitle}</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === "companion" }}
        onPress={() => {
          // Chosen already, the tab goes to the other Companion in the window: Chronicler's from a quest's, and back.
          const next = activeTab === "companion" ? otherPillId : pillId;
          if (next !== null) dock.choose(next);
        }}
        style={[local.tab, activeTab === "companion" && local.tabActive]}
      >
        <Text style={[local.tabText, activeTab === "companion" && local.tabTextActive]}>
          {companionPicker?.isChronicler === true && <Text style={local.chroniclerMark}>✦ </Text>}
          Companions
        </Text>
      </Pressable>
    </View>
  );
  const wideColumn = isColumnOpen && (
    <QuestColumn edge={edge} isWide={true} onClose={null} tabs={tabs} title={panelTitle} width={questWidth}>
      {hasQuestPanel && <View style={[local.questTab, activeTab !== "quest" && local.hidden]}>{questPanel}</View>}
      {activeTab === "companion" &&
        (companionPicker === null ? (
          <Text style={local.noCompanion}>There is no Companion to choose here.</Text>
        ) : (
          <CompanionPanel key={pillId} {...companionPicker} />
        ))}
    </QuestColumn>
  );
  return {
    companionDock: dock,
    hasEdgeHandle,
    isColumnOpen,
    isCompanionShown,
    isPanelShown,
    panelColumn,
    pillId,
    questTabButton,
    questWidth,
    setPanel,
    toggleColumn,
    wideColumn,
  };
}

const local = StyleSheet.create({
  chroniclerMark: { color: colors.accentText },
  hidden: { display: "none" },
  noCompanion: { color: colors.textMuted, padding: 16 },
  // The quest panel under the tabs, in the column's own flow so the tabs stay in view.
  questTab: { flex: 1 },
  tab: {
    alignItems: "center",
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 6,
  },
  tabActive: { backgroundColor: colors.controlActive },
  tabs: { flexDirection: "row", gap: 6, padding: 8 },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
  tabTextActive: { color: colors.accentText, fontWeight: "700" },
});

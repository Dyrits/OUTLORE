import type { Dispatch, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { ChroniclerConversation } from "../conversation/guildmaster";
import { CompanionPanel } from "../editors/companionPicker";
import {
  CompanionDockActions,
  CompanionTabOf,
  QuestPanelSetter,
  SidebarShown,
  TopBarShown,
} from "../foundation/shellContext";
import { colors, radii } from "../foundation/theme";
import type { RightPanel } from "../foundation/useRightPanel";
import { ChroniclerColumn, chroniclerColumnWidth } from "./chroniclerDock";
import { EdgeResizer } from "./edgeResizer";
import type { Location, NavigationEvent } from "./location";
import type { RealmListing } from "./questTree";
import {
  chroniclerWidthKey,
  clampPaneWidth,
  clampRailWidth,
  minRailWidth,
  questPanelWidthKey,
  readChroniclerOpen,
  readHidden,
  readPaneWidth,
  readRailWidth,
  rememberChroniclerOpen,
  rememberHidden,
  rememberPaneWidth,
  rememberRailWidth,
} from "./railStorage";
import { type Place, Sidebar } from "./sidebar";
import { type DetailsToggle, PanelIcon, QuestColumn, questColumnWidth, TopBar } from "./topBar";
import { useCompanionDock } from "./useCompanionDock";
import { viewingOf } from "./viewing";

/** The window width from which the sidebar shows beside the content; narrower windows keep the screens' own links. */
const sidebarBreakpoint = 820;

/** The size of the round handle on the rail's edge that collapses and expands it. */
const handleSize = 26;

/**
 * The window's frame: on a wide window the sidebar, which collapses to icons, beside a top bar over the content; on
 * a narrow one the content alone.
 */
export function Shell(
  props: Omit<Parameters<typeof Sidebar>[0], "width"> & {
    children: ReactNode;
    location: Location;
    dispatch: Dispatch<NavigationEvent>;
    details: DetailsToggle | null;
    /** The place the content shows, told to Chronicler. */
    place: Place | null;
    rightPanel: RightPanel;
    /** The realm whose quest list is open, named in the top bar. */
    listedRealm: RealmListing | null;
    /** The realm chosen for Chronicler's next message, from a realm's page, and how to clear it. */
    chronicler: { onRealm: (path: string | null) => void; realmPath: string | null };
  },
) {
  const { width } = useWindowDimensions();
  const [isHidden, setIsHidden] = useState(readHidden);
  const [storedRailWidth, setRailWidth] = useState(readRailWidth);
  // Held to a quarter of the window again whenever the window changes size; the remembered width stays as dragged.
  const railWidth = clampRailWidth(storedRailWidth, width);
  // The quest panel's and Chronicler's columns, each dragged between its own width and a quarter of the window, as the rail.
  const [storedQuestWidth, setQuestWidth] = useState(() => readPaneWidth(questPanelWidthKey, questColumnWidth));
  const questWidth = clampPaneWidth(storedQuestWidth, width, questColumnWidth);
  const [storedChroniclerWidth, setChroniclerWidth] = useState(() =>
    readPaneWidth(chroniclerWidthKey, chroniclerColumnWidth),
  );
  const chroniclerWidth = clampPaneWidth(storedChroniclerWidth, width, chroniclerColumnWidth);
  // Chronicler's panel: folded to a pill or open, remembered; a realm chosen for its next message opens it.
  const [isChroniclerOpen, setIsChroniclerOpen] = useState(readChroniclerOpen);
  const { isChroniclerFull, isMenuOpen, isNarrowChroniclerOpen } = props.location;
  const setIsChroniclerFull = (isOpen: boolean) => props.dispatch({ isOpen, type: "full" });
  const setIsMenuOpen = (isOpen: boolean) => props.dispatch({ isOpen, type: "menu" });
  const setIsNarrowChroniclerOpen = (isOpen: boolean) => props.dispatch({ isOpen, type: "narrowChronicler" });
  const setChroniclerOpen = (isOpen: boolean) => {
    rememberChroniclerOpen(isOpen);
    setIsChroniclerOpen(isOpen);
    if (!isOpen) setIsChroniclerFull(false);
  };
  const chroniclerToggle = { isOpen: isChroniclerOpen, onToggle: () => setChroniclerOpen(!isChroniclerOpen) };
  const narrowChroniclerToggle = {
    isOpen: isNarrowChroniclerOpen,
    onToggle: () => {
      setIsNarrowChroniclerOpen(!isNarrowChroniclerOpen);
    },
  };
  const { realmPath: chroniclerRealmPath } = props.chronicler;
  useEffect(() => {
    if (chroniclerRealmPath !== null) {
      rememberChroniclerOpen(true);
      setIsChroniclerOpen(true);
    }
  }, [chroniclerRealmPath]);
  const [questPanel, setQuestPanel] = useState<ReactNode>(null);
  const [panelTitle, setPanelTitle] = useState("Quest");
  const setPanel = useCallback((panel: ReactNode, title: string) => {
    setQuestPanel(panel);
    setPanelTitle(title);
  }, []);
  const hasRail = width >= sidebarBreakpoint;
  const toggle = () => {
    rememberHidden(!isHidden);
    setIsHidden(!isHidden);
  };
  // Command or Control with B shows or hides the rail, as in editors; the browser's own handling is kept elsewhere.
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;
  useEffect(() => {
    if (!hasRail || typeof document === "undefined") return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hasRail]);
  const { details } = props;
  const isPanelShown = !isChroniclerFull && details?.isOpen === true && questPanel !== null;
  const panelColumn = isPanelShown && details !== null && (
    <QuestColumn
      edge={
        <EdgeResizer
          label="Resize the quest panel"
          leastWidth={questColumnWidth}
          onChange={setQuestWidth}
          onRelease={(next) => rememberPaneWidth(questPanelWidthKey, next)}
          side="start"
          width={questWidth}
          windowWidth={width}
        />
      }
      isWide={hasRail}
      onClose={details.isPinned === true ? null : details.onToggle}
      title={panelTitle}
      width={questWidth}
    >
      {questPanel}
    </QuestColumn>
  );
  const { rightPanel } = props;
  const {
    companionPicker,
    dock: companionDock,
    hasCompanion,
    isCompanionShown,
    otherPillId,
    pillId,
  } = useCompanionDock(rightPanel, isChroniclerFull, isChroniclerOpen);
  const hasQuestPanel = !isChroniclerFull && details !== null && questPanel !== null;
  const activeTab = rightPanel.content?.tab ?? "quest";
  const isColumnOpen = isCompanionShown || (hasQuestPanel && details.isOpen);
  const toggleColumn = () => {
    if (isColumnOpen) rightPanel.show(null);
    else if (hasQuestPanel) rightPanel.show({ tab: "quest" });
    else if (pillId !== null) companionDock.choose(pillId);
  };
  const columnTabs = (
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
          if (next !== null) companionDock.choose(next);
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
    <QuestColumn
      edge={
        <EdgeResizer
          label="Resize the quest panel"
          leastWidth={questColumnWidth}
          onChange={setQuestWidth}
          onRelease={(next) => rememberPaneWidth(questPanelWidthKey, next)}
          side="start"
          width={questWidth}
          windowWidth={width}
        />
      }
      isWide={true}
      onClose={null}
      tabs={columnTabs}
      title={panelTitle}
      width={questWidth}
    >
      {hasQuestPanel && <View style={[local.questTab, activeTab !== "quest" && local.hidden]}>{questPanel}</View>}
      {activeTab === "companion" &&
        (companionPicker === null ? (
          <Text style={local.noCompanion}>There is no Companion to choose here.</Text>
        ) : (
          <CompanionPanel key={pillId} {...companionPicker} />
        ))}
    </QuestColumn>
  );
  // Beside every screen Chronicler is a column; a narrow window gives it the whole content
  // area instead, and its restore button closes it.
  // Chronicler's column stands at the window's far right, past the quest panel, which its handle then clears.
  const isChroniclerColumn = isChroniclerOpen && hasRail && !isChroniclerFull;
  const chroniclerOffset = isChroniclerColumn ? chroniclerWidth : 0;
  const chroniclerChat = (
    <ChroniclerConversation
      client={props.client}
      isFull={isChroniclerFull || !hasRail}
      onFold={null}
      onOpenMission={props.onOpenMission}
      onRealm={props.chronicler.onRealm}
      onToggleFull={() => (hasRail ? setIsChroniclerFull(!isChroniclerFull) : setIsNarrowChroniclerOpen(false))}
      realmPath={props.chronicler.realmPath}
      viewing={viewingOf(props.place, props.openMission, props.listedRealm?.name ?? null, isChroniclerFull)}
    />
  );
  const chroniclerFull = isChroniclerOpen && isChroniclerFull && <View style={local.fill}>{chroniclerChat}</View>;
  // A narrow window has the top bar over the content alone; its menu button opens a full-screen menu of the places. An
  // open quest panel, the menu, or Chronicler takes the content's place; the content stays mounted, so the open thread
  // is kept.
  const isNarrowCovered = isPanelShown || isMenuOpen || isNarrowChroniclerOpen;
  if (!hasRail) {
    return (
      <QuestPanelSetter.Provider value={setPanel}>
        <TopBarShown.Provider value={true}>
          <View style={local.narrow}>
            <TopBar
              chronicler={narrowChroniclerToggle}
              details={details}
              menu={{
                isOpen: isMenuOpen,
                onToggle: () => {
                  setIsMenuOpen(!isMenuOpen);
                },
              }}
            />
            <View style={[local.narrowContent, isNarrowCovered && local.hidden]}>{props.children}</View>
            {isMenuOpen && (
              <View style={[local.narrowContent, local.menuScreen]}>
                <Sidebar {...props} width="100%" />
              </View>
            )}
            {isNarrowChroniclerOpen && !isMenuOpen && <View style={local.narrowContent}>{chroniclerChat}</View>}
            {!isMenuOpen && !isNarrowChroniclerOpen && panelColumn}
          </View>
        </TopBarShown.Provider>
      </QuestPanelSetter.Provider>
    );
  }
  return (
    <QuestPanelSetter.Provider value={setPanel}>
      <SidebarShown.Provider value={true}>
        <CompanionDockActions.Provider value={companionDock}>
          <CompanionTabOf.Provider value={isCompanionShown ? pillId : null}>
            <TopBarShown.Provider value={true}>
              <View style={local.window}>
                <TopBar chronicler={chroniclerToggle} details={null} />
                <View style={local.body}>
                  <View style={local.frame}>
                    {!isHidden && (
                      <Sidebar
                        {...props}
                        onOpenMission={props.onOpenMission}
                        onOpenRealmQuests={props.onOpenRealmQuests}
                        onOpenThread={props.onOpenThread}
                        openMission={isChroniclerFull ? null : props.openMission}
                        openThread={isChroniclerFull ? null : props.openThread}
                        width={railWidth}
                      />
                    )}
                    {!isHidden && (
                      <EdgeResizer
                        label="Resize the sidebar"
                        leastWidth={minRailWidth}
                        onChange={setRailWidth}
                        onRelease={rememberRailWidth}
                        side="end"
                        width={railWidth}
                        windowWidth={width}
                      />
                    )}
                    <Pressable
                      accessibilityLabel={isHidden ? "Show sidebar (⌘B)" : "Hide sidebar (⌘B)"}
                      accessibilityRole="button"
                      onPress={toggle}
                      style={({ pressed }) => [
                        local.handle,
                        isHidden ? local.handleTab : { left: railWidth - handleSize / 2 },
                        pressed && local.handlePressed,
                      ]}
                    >
                      <PanelIcon />
                    </Pressable>
                    <View style={local.panel}>
                      {props.children}
                      {chroniclerFull}
                    </View>
                  </View>
                  {wideColumn}
                  {isChroniclerColumn && (
                    <ChroniclerColumn
                      edge={
                        <EdgeResizer
                          label="Resize Chronicler"
                          leastWidth={chroniclerColumnWidth}
                          onChange={setChroniclerWidth}
                          onRelease={(next) => rememberPaneWidth(chroniclerWidthKey, next)}
                          side="start"
                          width={chroniclerWidth}
                          windowWidth={width}
                        />
                      }
                      width={chroniclerWidth}
                    >
                      {chroniclerChat}
                    </ChroniclerColumn>
                  )}
                  {(hasQuestPanel ? details.isPinned !== true : hasCompanion) && (
                    <Pressable
                      accessibilityLabel={isColumnOpen ? "Hide quest panel" : "Show quest panel"}
                      accessibilityRole="button"
                      onPress={toggleColumn}
                      style={({ pressed }) => [
                        local.handle,
                        isColumnOpen
                          ? { right: questWidth - handleSize / 2 + chroniclerOffset }
                          : [local.endHandleTab, { right: chroniclerOffset }],
                        pressed && local.handlePressed,
                      ]}
                    >
                      <PanelIcon side="right" />
                    </Pressable>
                  )}
                </View>
              </View>
            </TopBarShown.Provider>
          </CompanionTabOf.Provider>
        </CompanionDockActions.Provider>
      </SidebarShown.Provider>
    </QuestPanelSetter.Provider>
  );
}

const local = StyleSheet.create({
  // The window below the top bar: the frame, then the quest panel and Chronicler's column, which the quest panel's handle
  // straddles; the handle is centered on this body.
  body: { flex: 1, flexDirection: "row" },
  // Chronicler's own mark, as on its button in the top bar.
  chroniclerMark: { color: colors.accentText },
  // Closed, the handle is the half of a circle against the window's right edge.
  endHandleTab: {
    borderBottomRightRadius: 0,
    borderRightWidth: 0,
    borderTopRightRadius: 0,
    height: handleSize * 1.5,
    marginTop: -handleSize * 0.75,
    paddingLeft: 3,
    right: 0,
    width: handleSize * 0.75,
  },
  // Chronicler restored to the whole content area: over the screen, which stays mounted beneath, and the sidebar stays.
  fill: { backgroundColor: colors.page, bottom: 0, left: 0, position: "absolute", right: 0, top: 0, zIndex: 7 },
  frame: { backgroundColor: colors.ground, flex: 1, flexDirection: "row", overflow: "hidden" },
  handle: {
    alignItems: "center",
    backgroundColor: colors.sidebar,
    borderColor: colors.edge,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: handleSize,
    justifyContent: "center",
    marginTop: -handleSize / 2,
    position: "absolute",
    top: "50%",
    width: handleSize,
    // Above the strip that resizes the sidebar, which runs beneath the button.
    zIndex: 4,
  },
  handlePressed: { backgroundColor: colors.ground },
  // Hidden, the handle is the half of a circle against the window's left edge.
  handleTab: {
    borderBottomLeftRadius: 0,
    borderLeftWidth: 0,
    borderTopLeftRadius: 0,
    height: handleSize * 1.5,
    left: 0,
    marginTop: -handleSize * 0.75,
    paddingRight: 3,
    width: handleSize * 0.75,
  },
  hidden: { display: "none" },
  // The full-screen menu is a row so the sidebar stretches to the window's height, as in the wide frame, and its foot
  // sits at the bottom of the screen.
  menuScreen: { flexDirection: "row" },
  narrow: { backgroundColor: colors.page, flex: 1 },
  narrowContent: { flex: 1 },
  noCompanion: { color: colors.textMuted, padding: 16 },
  panel: {
    backgroundColor: colors.page,
    borderColor: colors.borderStrong,
    borderLeftWidth: 1.5,
    flex: 1,
    overflow: "hidden",
  },
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
  window: { backgroundColor: colors.ground, flex: 1 },
});

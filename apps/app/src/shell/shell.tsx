import type { Dispatch, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { ChroniclerConversation } from "../conversation/guildmaster";
import {
  CompanionDockActions,
  CompanionTabOf,
  QuestPanelSetter,
  QuestTabButtonContext,
  SidebarShown,
  TopBarShown,
} from "../foundation/shellContext";
import { chooseSidebarPinned, useSidebarPreference } from "../foundation/sidebarPreference";
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
  readChroniclerOpen,
  readHidden,
  readPaneWidth,
  readRailWidth,
  rememberChroniclerOpen,
  rememberHidden,
  rememberPaneWidth,
  rememberRailWidth,
} from "./railStorage";
import { handleSize, shellStyles as local } from "./shellStyles";
import { type Place, Sidebar } from "./sidebar";
import { sidebarPlacementOf } from "./sidebarMode";
import { SidebarOverlay } from "./sidebarOverlay";
import { type DetailsToggle, PanelIcon, TopBar } from "./topBar";
import { useDetailsColumn } from "./useDetailsColumn";
import { useSidebarOverlay } from "./useSidebarOverlay";
import { viewingOf } from "./viewing";

/** The window width from which the sidebar shows beside the content; narrower windows keep the screens' own links. */
const sidebarBreakpoint = 820;

/**
 * The window's frame: on a wide window the sidebar, floating over the panes until the pointer asks for it or docked
 * beside them (CHG-0560), under a top bar over the content; on a narrow one the content alone.
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
  const hasRail = width >= sidebarBreakpoint;
  const { isPinned, mode, side } = useSidebarPreference();
  const placement = sidebarPlacementOf({ isPinned, mode });
  // The overlay's own pointer, button and key rules apply in both of its states; a pinned sidebar stands in the frame.
  const isOverlay = mode === "overlay";
  const isFloating = placement === "floating";
  const togglePin = () => chooseSidebarPinned(!isPinned);
  const [isHidden, setIsHidden] = useState(readHidden);
  const [storedRailWidth, setRailWidth] = useState(readRailWidth);
  // Held to a quarter of the window again whenever the window changes size; the remembered width stays as dragged.
  const railWidth = clampRailWidth(storedRailWidth, width);
  const overlay = useSidebarOverlay({
    isEnabled: hasRail && isFloating,
    panelWidth: railWidth,
    side,
    windowWidth: width,
  });
  // Chronicler's column, dragged between its own width and a quarter of the window, as the rail.
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
  const { details, rightPanel } = props;
  const column = useDetailsColumn({
    details,
    hasRail,
    isChroniclerFull,
    isChroniclerOpen,
    isQuestOpen: props.openMission !== null,
    rightPanel,
  });
  const { companionDock, isCompanionShown, pillId, questWidth } = column;
  const toggle = () => {
    rememberHidden(!isHidden);
    setIsHidden(!isHidden);
  };
  // Command or Control with B shows or hides the sidebar, as in editors: it pins or unpins the overlay, as the top bar's
  // button does, or hides the docked rail; the browser's own handling is kept elsewhere.
  const toggleRef = useRef(toggle);
  toggleRef.current = isOverlay ? togglePin : toggle;
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
  const isNarrowCovered = column.isPanelShown || isMenuOpen || isNarrowChroniclerOpen;
  if (!hasRail) {
    return (
      <QuestPanelSetter.Provider value={column.setPanel}>
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
            {!isMenuOpen && !isNarrowChroniclerOpen && column.panelColumn}
          </View>
        </TopBarShown.Provider>
      </QuestPanelSetter.Provider>
    );
  }
  const sidebar = (
    <Sidebar
      {...props}
      openMission={isChroniclerFull ? null : props.openMission}
      openThread={isChroniclerFull ? null : props.openThread}
      width={railWidth}
    />
  );
  // Choosing something in the floating sidebar puts it away, so the panes are not left covered.
  const choosing = <Args extends unknown[]>(action: (...args: Args) => void) => {
    return (...args: Args) => {
      overlay.close();
      action(...args);
    };
  };
  // A docked or pinned sidebar stands in the frame, at the left, or at the window's right edge when pinned there.
  const hasLeftRail = placement === "docked" ? !isHidden : placement === "pinned" && side === "left";
  const hasRightRail = placement === "pinned" && side === "right";
  const floatingSidebar = (
    <SidebarOverlay isOpen={overlay.isOpen} side={side} width={railWidth}>
      <Sidebar
        {...props}
        onOpenMission={choosing(props.onOpenMission)}
        onOpenRealmQuests={choosing(props.onOpenRealmQuests)}
        onOpenThread={choosing(props.onOpenThread)}
        onWorkshop={choosing(props.onWorkshop)}
        openMission={isChroniclerFull ? null : props.openMission}
        openThread={isChroniclerFull ? null : props.openThread}
        width={railWidth}
      />
      <EdgeResizer
        label="Resize the sidebar"
        leastWidth={minRailWidth}
        onChange={(next) => {
          overlay.setIsResizing(true);
          setRailWidth(next);
        }}
        onRelease={(next) => {
          overlay.setIsResizing(false);
          rememberRailWidth(next);
        }}
        side={side === "left" ? "end" : "start"}
        width={railWidth}
        windowWidth={width}
      />
    </SidebarOverlay>
  );
  return (
    <QuestPanelSetter.Provider value={column.setPanel}>
      <SidebarShown.Provider value={true}>
        <CompanionDockActions.Provider value={companionDock}>
          <CompanionTabOf.Provider value={isCompanionShown ? pillId : null}>
            <TopBarShown.Provider value={true}>
              <QuestTabButtonContext.Provider value={column.questTabButton}>
                <View style={local.window}>
                  <TopBar
                    chronicler={chroniclerToggle}
                    details={null}
                    sidebar={isOverlay ? { isPinned, onToggle: togglePin, side } : undefined}
                  />
                  <View style={local.body}>
                    <View style={local.frame}>
                      {hasLeftRail && sidebar}
                      {hasLeftRail && (
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
                      {placement === "docked" && (
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
                      )}
                      <View style={local.panel}>
                        {props.children}
                        {chroniclerFull}
                      </View>
                    </View>
                    {column.wideColumn}
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
                    {column.hasEdgeHandle && (
                      <Pressable
                        accessibilityLabel={column.isColumnOpen ? "Hide quest panel" : "Show quest panel"}
                        accessibilityRole="button"
                        onPress={column.toggleColumn}
                        style={({ pressed }) => [
                          local.handle,
                          column.isColumnOpen
                            ? { right: questWidth - handleSize / 2 + chroniclerOffset }
                            : [local.endHandleTab, { right: chroniclerOffset }],
                          pressed && local.handlePressed,
                        ]}
                      >
                        <PanelIcon side="right" />
                      </Pressable>
                    )}
                    {hasRightRail && (
                      <View style={{ width: railWidth }}>
                        {sidebar}
                        <EdgeResizer
                          label="Resize the sidebar"
                          leastWidth={minRailWidth}
                          onChange={setRailWidth}
                          onRelease={rememberRailWidth}
                          side="start"
                          width={railWidth}
                          windowWidth={width}
                        />
                      </View>
                    )}
                    {isFloating && floatingSidebar}
                  </View>
                </View>
              </QuestTabButtonContext.Provider>
            </TopBarShown.Provider>
          </CompanionTabOf.Provider>
        </CompanionDockActions.Provider>
      </SidebarShown.Provider>
    </QuestPanelSetter.Provider>
  );
}

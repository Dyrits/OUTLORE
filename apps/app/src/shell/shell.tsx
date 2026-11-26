import type { Dispatch, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { useActiveHost } from "../foundation/hostContext";
import { useIslandFrame } from "../foundation/islands";
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
import { EdgeResizer } from "./edgeResizer";
import type { Location, NavigationEvent } from "./location";
import { NarrowShell } from "./narrowShell";
import {
  clampRailWidth,
  minRailWidth,
  readHidden,
  readRailWidth,
  rememberHidden,
  rememberRailWidth,
} from "./railStorage";
import { handleSize, shellStyles as local } from "./shellStyles";
import { Sidebar, type SidebarProps } from "./sidebar";
import { sidebarPlacementOf } from "./sidebarMode";
import { SidebarOverlay } from "./sidebarOverlay";
import { type DetailsToggle, PanelIcon, TopBar } from "./topBar";
import { useDetailsColumn } from "./useDetailsColumn";
import { useSidebarOverlay } from "./useSidebarOverlay";
import { hasConversationPanes } from "./windowView";

/** The window width from which the sidebar shows beside the content; narrower windows keep the screens' own links. */
const sidebarBreakpoint = 820;

/**
 * The window's frame: on a wide window the sidebar, floating over the panes until the pointer asks for it or docked
 * beside them (CHG-0560), under a top bar over the content; on a narrow one the content alone.
 */
export function Shell(
  props: Omit<SidebarProps, "hasLeftDivider" | "width"> & {
    children: ReactNode;
    location: Location;
    dispatch: Dispatch<NavigationEvent>;
    details: DetailsToggle | null;
    rightPanel: RightPanel;
  },
) {
  const { width } = useWindowDimensions();
  const { hostId } = useActiveHost();
  const hasRail = width >= sidebarBreakpoint;
  // The Islands layout floats the sidebar, each pane, the content, and the quest panel as panels on a canvas, in any
  // theme (CHG-0672); the narrow window below keeps its flat frame.
  const islands = useIslandFrame();
  const islandBackground = islands?.background ?? null;
  useEffect(() => {
    if (!hasRail || islandBackground === null || typeof document === "undefined") return;
    const page = document.documentElement.style;
    page.backgroundImage = islandBackground;
    // Back to the flat layout, the page behind the app shows the theme's ground, its background color, again.
    return () => {
      page.backgroundImage = "";
    };
  }, [hasRail, islandBackground]);
  const gap = islands?.gap ?? 0;
  const { isPinned, mode, side } = useSidebarPreference();
  const placement = sidebarPlacementOf({ isPinned, mode });
  // The overlay's own pointer, button and key rules apply in both of its states; a pinned sidebar stands in the frame.
  const isOverlay = mode === "overlay";
  const isFloating = placement === "floating";
  const togglePin = useCallback(() => chooseSidebarPinned(!isPinned), [isPinned]);
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
  const { ritualForm } = props.location;
  const { close: closeSidebar } = overlay;
  useEffect(() => {
    if (ritualForm !== null) closeSidebar();
  }, [closeSidebar, ritualForm]);
  const { details, rightPanel } = props;
  const hasPanes = hasConversationPanes(props.location);
  const column = useDetailsColumn({
    details,
    hasRail,
    isChroniclerOpen: hasRail && hasPanes,
    isQuestOpen: props.openMission !== null,
    rightPanel,
  });
  const { companionDock, isCompanionShown, pillId, questWidth } = column;
  // The sidebar and the top bar are panels of their own: they get only what they show, each with one identity, so
  // another panel's change, such as the details column opening, leaves them as they are.
  const {
    client,
    isWorkshopOpen,
    onOpenChannel,
    onOpenChronicle,
    onOpenErrands,
    onOpenMission,
    onOpenQuestsTab,
    onOpenThread,
    onWorkshop,
    openMission,
    openThread,
  } = props;
  const sidebarProps = useMemo(
    () => ({
      client,
      isWorkshopOpen,
      onOpenChannel,
      onOpenChronicle,
      onOpenErrands,
      onOpenMission,
      onOpenQuestsTab,
      onOpenThread,
      onWorkshop,
      openMission,
      openThread,
    }),
    [
      client,
      isWorkshopOpen,
      onOpenChannel,
      onOpenChronicle,
      onOpenErrands,
      onOpenMission,
      onOpenQuestsTab,
      onOpenThread,
      onWorkshop,
      openMission,
      openThread,
    ],
  );
  // Choosing something in the floating sidebar puts it away, so the panes are not left covered.
  const overlayProps = useMemo(() => {
    const choosing = <Args extends unknown[]>(action: (...args: Args) => void) => {
      return (...args: Args) => {
        closeSidebar();
        action(...args);
      };
    };
    return {
      ...sidebarProps,
      ...(onOpenChannel === undefined ? {} : { onOpenChannel: choosing(onOpenChannel) }),
      ...(onOpenChronicle === undefined ? {} : { onOpenChronicle: choosing(onOpenChronicle) }),
      onOpenErrands: choosing(onOpenErrands),
      onOpenMission: choosing(onOpenMission),
      onOpenQuestsTab: choosing(onOpenQuestsTab),
      onOpenThread: choosing(onOpenThread),
      onWorkshop: choosing(onWorkshop),
    };
  }, [
    closeSidebar,
    onOpenChannel,
    onOpenChronicle,
    onOpenErrands,
    onOpenMission,
    onOpenQuestsTab,
    onOpenThread,
    onWorkshop,
    sidebarProps,
  ]);
  const topBarSidebar = useMemo(
    () => (isOverlay ? { isPinned, onToggle: togglePin, side } : undefined),
    [isOverlay, isPinned, side, togglePin],
  );

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
  // A narrow window has the top bar over the content, and the floating bar of tabs over both (CHG-0773).
  const showsDetails = ritualForm === null && column.isPanelShown;
  if (!hasRail) {
    return (
      <QuestPanelSetter.Provider value={column.setPanel}>
        <TopBarShown.Provider value={true}>
          <NarrowShell
            client={props.client}
            details={details}
            dispatch={props.dispatch}
            // The bar's choices belong to one computer: another host starts with none.
            key={hostId ?? "this-computer"}
            location={props.location}
            panelColumn={column.panelColumn}
            showsDetails={showsDetails}
          >
            {props.children}
          </NarrowShell>
        </TopBarShown.Provider>
      </QuestPanelSetter.Provider>
    );
  }
  // A docked or pinned sidebar stands in the frame, at the left, or at the window's right edge when pinned there.
  const hasLeftRail = placement === "docked" ? !isHidden : placement === "pinned" && side === "left";
  const hasRightRail = placement === "pinned" && side === "right";
  // In the Islands layout the content is an island of its own, except where it holds the panes, which are islands each:
  // a quest's panes, or the realm's channel alone.
  const isPaneRow = hasPanes && ritualForm === null;
  const panelStyle =
    islands === null ? hasLeftRail && local.panelDivider : isPaneRow ? local.panelOfIslands : islands.island;
  const sidebar = <Sidebar {...sidebarProps} hasLeftDivider={hasRightRail} width={railWidth} />;
  const floatingSidebar = (
    <SidebarOverlay isOpen={overlay.isOpen} side={side} width={railWidth}>
      <Sidebar {...overlayProps} width={railWidth} />
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
                <View style={[local.window, islands !== null && local.islandWindow]}>
                  <TopBar details={null} sidebar={topBarSidebar} />
                  <View style={[local.body, islands !== null && { gap, paddingBottom: gap, paddingHorizontal: gap }]}>
                    <View style={[local.frame, islands !== null && [local.islandFrame, { gap }]]}>
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
                            isHidden ? local.handleTab : { left: railWidth + gap / 2 - handleSize / 2 },
                            pressed && local.handlePressed,
                          ]}
                        >
                          <PanelIcon />
                        </Pressable>
                      )}
                      <View style={[local.panel, panelStyle]}>{props.children}</View>
                    </View>
                    {!hasPanes && column.wideColumn}
                    {!hasPanes && column.hasEdgeHandle && (
                      <Pressable
                        accessibilityLabel={column.isColumnOpen ? "Hide quest panel" : "Show quest panel"}
                        accessibilityRole="button"
                        onPress={column.toggleColumn}
                        style={({ pressed }) => [
                          local.handle,
                          column.isColumnOpen ? { right: questWidth + gap * 1.5 - handleSize / 2 } : local.endHandleTab,
                          pressed && local.handlePressed,
                        ]}
                      >
                        <PanelIcon side="right" />
                      </Pressable>
                    )}
                    {hasRightRail && (
                      // A row, so the sidebar stretches to the window's height as it does in the frame.
                      <View style={{ flexDirection: "row", width: railWidth }}>
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

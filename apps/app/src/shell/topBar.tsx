import { memo, type ReactNode, useContext } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { HostMenuContext } from "../foundation/hostContext";
import { useIslandFrame } from "../foundation/islands";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { UpdateNotice } from "../updates";
import { unreadCountOf } from "./chronicleFeed";
import { HostMenu } from "./hostMenu";

// The window's top bar: the host menu, the spending, the quest panel's icon, and the column that
// holds the quest panel.

/** Whether the desktop window has no system title bar, so the top bar takes its place. */
export const hasOwnTitleBar = typeof window !== "undefined" && window.outlore?.hasOwnTitleBar === true;

// Electron drags the window by a region marked this way; react-native-web passes the property to the page.
/** Marks a region that drags the window. */
export const dragRegion = { WebkitAppRegion: "drag" } as object;
/** Marks a region inside a drag region that is pressed instead. */
export const noDragRegion = { WebkitAppRegion: "no-drag" } as object;

/**
 * The quest's side panel as the top bar offers it: whether it shows, and how to show or hide it. `isPinned` keeps the
 * panel open with no way to hide it, as on the quest board, where it always has something to show.
 */
export type DetailsToggle = { isOpen: boolean; isPinned?: boolean; onToggle: () => void };

/** The width of the quest panel's column on a wide window. */
export const questColumnWidth = 360;

/** The icon of a window with its left panel: the rail's collapse and expand button. */
export function PanelIcon({ side = "left" }: { side?: "left" | "right" }) {
  return (
    <View style={[local.panelIcon, side === "right" && local.panelIconRight]}>
      <View style={side === "left" ? local.panelIconLeft : local.panelIconEnd} />
    </View>
  );
}

/**
 * The top bar: the host menu at its start and, at the end, the quest panel's icon and, furthest right like its panel, Chronicler's mark. It names no place: the rail and the screens say where the owner is.
 */
export const TopBar = memo(function TopBar({
  details,
  chronicler,
  menu,
  sidebar,
}: {
  /** The icon that shows or hides the quest's side panel; none outside a quest. */
  details: DetailsToggle | null;
  /** The button that opens or folds Chronicler's screen in a window too narrow for panes; where the Chronicle is a pane, none. */
  chronicler?: { isOpen: boolean; onToggle: () => void };
  /** The button that opens or closes the full-screen menu, in a window too narrow for the sidebar; none where it shows. */
  menu?: { isOpen: boolean; onToggle: () => void; unreadCount?: number };
  /** The button that pins or unpins the overlay sidebar, on the side the sidebar belongs to; none when it is docked. */
  sidebar?: { isPinned: boolean; onToggle: () => void; side: "left" | "right" };
}) {
  const hostMenu = useContext(HostMenuContext);
  const islands = useIslandFrame();
  // On the Islands canvas, the canvas's own color would hide the pressed state.
  const isOnCanvas = islands !== null && menu === undefined;
  const active = isOnCanvas ? local.topIconOnCanvas : local.topIconActive;
  const sidebarButton = sidebar !== undefined && (
    <Pressable
      accessibilityLabel={sidebar.isPinned ? "Unpin the sidebar (⌘B)" : "Pin the sidebar (⌘B)"}
      accessibilityRole="button"
      accessibilityState={{ selected: sidebar.isPinned }}
      onPress={sidebar.onToggle}
      style={({ pressed }) => [local.topIcon, (pressed || sidebar.isPinned) && active, noDragRegion]}
    >
      <PanelIcon side={sidebar.side} />
    </Pressable>
  );
  return (
    // As the macOS title bar the bar drags the window, and leaves room for the traffic lights at its start.
    // In the Islands layout, the wide window's bar lies on the canvas above the islands.
    <View
      style={[
        local.topBar,
        isOnCanvas && local.topBarIsland,
        hasOwnTitleBar && local.topBarTitle,
        hasOwnTitleBar && dragRegion,
      ]}
    >
      {sidebar?.side === "left" && sidebarButton}
      {menu !== undefined && (
        <Pressable
          accessibilityLabel={
            menu.isOpen
              ? "Close the menu"
              : menu.unreadCount !== undefined && menu.unreadCount > 0
                ? `Open the menu, ${menu.unreadCount} unread`
                : "Open the menu"
          }
          accessibilityRole="button"
          accessibilityState={{ expanded: menu.isOpen }}
          onPress={menu.onToggle}
          style={({ pressed }) => [local.topIcon, (pressed || menu.isOpen) && active, noDragRegion]}
        >
          <PanelIcon />
          {menu.unreadCount !== undefined && menu.unreadCount > 0 && (
            // What needs the owner, seen from every phone screen: the Chronicle's unread count on the menu button.
            <View style={local.menuBadge}>
              <Text style={local.menuBadgeText}>{menu.unreadCount}</Text>
            </View>
          )}
        </Pressable>
      )}
      {hostMenu !== null && (
        <View style={noDragRegion}>
          <HostMenu {...hostMenu} />
        </View>
      )}
      <View style={local.spacer} />
      <View style={noDragRegion}>
        <UpdateNotice />
      </View>
      {details !== null && details.isPinned !== true && (
        <Pressable
          accessibilityLabel={details.isOpen ? "Hide quest panel" : "Show quest panel"}
          accessibilityRole="button"
          onPress={details.onToggle}
          style={({ pressed }) => [local.topIcon, (pressed || details.isOpen) && active, noDragRegion]}
        >
          <PanelIcon side="right" />
        </Pressable>
      )}
      {chronicler !== undefined && (
        <Pressable
          accessibilityLabel={chronicler.isOpen ? "Fold Chronicler" : "Ask Chronicler"}
          accessibilityRole="button"
          accessibilityState={{ expanded: chronicler.isOpen }}
          onPress={chronicler.onToggle}
          style={({ pressed }) => [local.topIcon, (pressed || chronicler.isOpen) && active, noDragRegion]}
        >
          <Text style={local.chroniclerMark}>✦</Text>
        </Pressable>
      )}
      {sidebar?.side === "right" && sidebarButton}
    </View>
  );
});

/**
 * The narrow window's top bar: its menu button carries the Chronicle's unread count, so what needs the owner shows
 * from every phone screen without opening the menu.
 */
export function NarrowTopBar({
  chronicler,
  client,
  details,
  menu,
}: {
  chronicler: { isOpen: boolean; onToggle: () => void };
  client: ServiceClient;
  details: DetailsToggle | null;
  menu: { isOpen: boolean; onToggle: () => void };
}) {
  const { data: chronicle } = useServiceQuery(client, { _tag: "ReadChronicle" }, "chronicle-menu-badge");
  const unreadCount = unreadCountOf(chronicle ?? []);
  return <TopBar chronicler={chronicler} details={details} menu={{ ...menu, unreadCount }} />;
}

/**
 * The quest panel's column. On a wide window it stands below the top bar, which spans the window, with no header of its
 * own (the top bar's icon hides it) and an `edge` strip the owner drags to widen it; on a narrow one it takes the
 * content's place, under a header with the close button.
 */
export function QuestColumn({
  children,
  edge,
  isWide,
  onClose,
  tabs,
  title,
  width,
}: {
  children: ReactNode;
  /** The strip on the column's left edge that resizes it; wide windows only. */
  edge?: ReactNode;
  isWide: boolean;
  /** Hides the panel; none when the panel is pinned open. */
  onClose: (() => void) | null;
  /** Tabs drawn above the content on a wide window, such as Quest and Companion. */
  tabs?: ReactNode;
  /** The panel's name in its top bar: Quest, or what another screen gave it. */
  title: string;
  /** The column's width on a wide window. */
  width: number;
}) {
  const islands = useIslandFrame();
  if (isWide)
    return (
      <View style={[local.questColumn, islands !== null && local.questColumnIsland, { width }]}>
        {edge}
        <View style={[local.questBody, islands?.island]}>
          {tabs}
          {children}
        </View>
      </View>
    );
  return (
    <View style={local.questColumnNarrow}>
      <View style={local.topBar}>
        {onClose !== null && (
          <Pressable
            accessibilityLabel="Hide quest panel"
            accessibilityRole="button"
            onPress={onClose}
            style={noDragRegion}
          >
            <Text style={local.questClose}>✕</Text>
          </Pressable>
        )}
        <Text style={[local.crumbText, local.crumbCurrent, onClose === null && local.crumbPinned]}>{title}</Text>
      </View>
      <View style={local.questBody}>{children}</View>
    </View>
  );
}

const local = StyleSheet.create({
  chroniclerMark: { color: colors.accentText, fontSize: fontSizes.lg },
  crumbCurrent: { color: colors.onGround },
  crumbPinned: { paddingLeft: 6 },
  crumbText: { fontFamily: fonts.sans, fontSize: fontSizes.lg },
  // The Chronicle's unread count on the narrow menu button, at its corner like an app icon's badge.
  menuBadge: {
    alignItems: "center",
    backgroundColor: colors.marker,
    borderColor: colors.accentText,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 15,
    paddingHorizontal: 3,
    position: "absolute",
    right: -6,
    top: -5,
  },
  menuBadgeText: { color: colors.accentText, fontFamily: fonts.sans, fontSize: 9, fontWeight: "600" },
  panelIcon: {
    borderColor: colors.onGround,
    borderRadius: 3,
    borderWidth: 1.5,
    flexDirection: "row",
    height: 13,
    overflow: "hidden",
    width: 16,
  },
  panelIconEnd: { borderColor: colors.onGround, borderLeftWidth: 1.5, marginLeft: "auto", width: 5 },
  panelIconLeft: { borderColor: colors.onGround, borderRightWidth: 1.5, width: 5 },
  panelIconRight: { justifyContent: "flex-end" },
  questBody: { backgroundColor: colors.page, flex: 1 },
  questClose: { color: colors.highlight, fontSize: fontSizes.base, paddingHorizontal: 4 },
  questColumn: { borderColor: colors.edge, borderLeftWidth: 1 },
  questColumnIsland: { borderLeftWidth: 0 },
  questColumnNarrow: { flex: 1 },
  spacer: { flex: 1 },
  topBar: {
    alignItems: "center",
    backgroundColor: colors.sidebar,
    borderBottomColor: colors.edge,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    height: 40,
    paddingHorizontal: 10,
  },
  topBarIsland: { backgroundColor: "transparent", borderBottomWidth: 0 },
  topBarTitle: { paddingLeft: 82 },
  topIcon: { alignItems: "center", borderRadius: radii.sm, height: 28, justifyContent: "center", width: 28 },
  topIconActive: { backgroundColor: colors.ground },
  topIconOnCanvas: { backgroundColor: colors.controlActive },
});

import { type ReactNode, useContext } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { HostMenuContext } from "../foundation/hostContext";
import { usedTextOf } from "../foundation/labels";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { SettingsIcon } from "../ui/settingsIcons";
import { HostMenu } from "./hostMenu";
import { UpdateNotice } from "./updateNotice";

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

/** The three bars of the button that opens the narrow window's menu. */
function MenuIcon() {
  return (
    <View style={local.menuIcon}>
      <View style={local.menuBar} />
      <View style={local.menuBar} />
      <View style={local.menuBar} />
    </View>
  );
}

/**
 * The top bar: the Workshop's gear at its start, the host menu beside it and, at the end, the spending, which the collapsed rail no longer shows,
 * and Chronicler's button. It names no place: the rail and the screens say where the owner is.
 */
export function TopBar({
  client,
  details,
  chronicler,
  menu,
  workshop,
}: {
  client: ServiceClient;
  /** The icon that shows or hides the quest's side panel; none outside a quest. */
  details: DetailsToggle | null;
  /** The button that opens or folds Chronicler's panel (quest coordination, Chronicler everywhere). */
  chronicler: { isOpen: boolean; onToggle: () => void };
  /** The button that opens or closes the full-screen menu, in a window too narrow for the sidebar; none where it shows. */
  menu?: { isOpen: boolean; onToggle: () => void };
  /** The Workshop's gear, left of the host menu: it stays pressed while the Workshop is shown, and a press then closes it. */
  workshop: { isOpen: boolean; onToggle: () => void };
}) {
  const hostMenu = useContext(HostMenuContext);
  return (
    // As the macOS title bar the bar drags the window, and leaves room for the traffic lights at its start.
    <View style={[local.topBar, hasOwnTitleBar && local.topBarTitle, hasOwnTitleBar && dragRegion]}>
      {menu !== undefined && (
        <Pressable
          accessibilityLabel={menu.isOpen ? "Close the menu" : "Open the menu"}
          accessibilityRole="button"
          accessibilityState={{ expanded: menu.isOpen }}
          onPress={menu.onToggle}
          style={({ pressed }) => [local.topIcon, (pressed || menu.isOpen) && local.topIconActive, noDragRegion]}
        >
          {menu.isOpen ? <Text style={local.menuClose}>✕</Text> : <MenuIcon />}
        </Pressable>
      )}
      <Pressable
        accessibilityLabel={workshop.isOpen ? "Close the Workshop" : "Open the Workshop"}
        accessibilityRole="button"
        accessibilityState={{ selected: workshop.isOpen }}
        onPress={workshop.onToggle}
        style={({ pressed }) => [local.topIcon, (pressed || workshop.isOpen) && local.topIconActive, noDragRegion]}
      >
        <SettingsIcon name="gear" size={18} tint={colors.textSecondary} />
      </Pressable>
      {hostMenu !== null && (
        <View style={noDragRegion}>
          <HostMenu {...hostMenu} />
        </View>
      )}
      <View style={local.spacer} />
      <View style={noDragRegion}>
        <UpdateNotice />
      </View>
      {menu === undefined && <SpendingLine client={client} />}
      <Pressable
        accessibilityLabel={chronicler.isOpen ? "Fold Chronicler" : "Ask Chronicler"}
        accessibilityRole="button"
        accessibilityState={{ expanded: chronicler.isOpen }}
        onPress={chronicler.onToggle}
        style={({ pressed }) => [
          local.chroniclerButton,
          (pressed || chronicler.isOpen) && local.topIconActive,
          noDragRegion,
        ]}
      >
        <Text style={local.chroniclerMark}>✦</Text>
        <Text style={local.chroniclerText}>Chronicler</Text>
      </Pressable>
      {details !== null && details.isPinned !== true && (
        <Pressable
          accessibilityLabel={details.isOpen ? "Hide quest panel" : "Show quest panel"}
          accessibilityRole="button"
          onPress={details.onToggle}
          style={({ pressed }) => [local.topIcon, (pressed || details.isOpen) && local.topIconActive, noDragRegion]}
        >
          <PanelIcon side="right" />
        </Pressable>
      )}
    </View>
  );
}

/** The spending of the global budget's period as one line; nothing while it is unread. */
function SpendingLine({ client }: { client: ServiceClient }) {
  const { data: global } = useServiceQuery(client, { _tag: "ReadBudget", missionId: null }, "budget:global");
  if (global === null) return null;
  return <Text style={local.topSpending}>{usedTextOf(global.consumption)}</Text>;
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
  if (isWide)
    return (
      <View style={[local.questColumn, { width }]}>
        {edge}
        <View style={local.questBody}>
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
  chroniclerButton: {
    alignItems: "center",
    borderRadius: radii.sm,
    flexDirection: "row",
    gap: 6,
    height: 28,
    paddingHorizontal: 9,
  },
  chroniclerMark: { color: colors.accentText, fontSize: fontSizes.md },
  chroniclerText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
  crumbCurrent: { color: colors.onGround },
  crumbPinned: { paddingLeft: 6 },
  crumbText: { fontFamily: fonts.sans, fontSize: fontSizes.lg },
  menuBar: { backgroundColor: colors.onGround, borderRadius: 1, height: 2 },
  menuClose: { color: colors.onGround, fontSize: fontSizes.base },
  menuIcon: { gap: 3, width: 16 },
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
  topBarTitle: { paddingLeft: 82 },
  topIcon: { alignItems: "center", borderRadius: radii.sm, height: 28, justifyContent: "center", width: 28 },
  topIconActive: { backgroundColor: colors.ground },
  topSpending: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.sm },
});

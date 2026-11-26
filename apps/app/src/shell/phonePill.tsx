import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { unreadCountOf } from "./chronicleFeed";
import { PhoneIcon } from "./phoneIcons";
import { type PhoneTab, phoneTabs, pillBottomGap, pillHeight, withOpacity } from "./phoneShell";

/** The gap under the pill: the larger one on a phone, whose home bar or gesture area lies at the window's edge. */
export const pillBottom = Platform.OS === "web" ? pillBottomGap.web : pillBottomGap.native;

// A browser can blur what the pill floats over; React Native has no such blur, so the translucent ground alone does it
// elsewhere. The fade is the browser's own transition, which react-native-web passes to the page.
const webOnly = (style: object) => (Platform.OS === "web" ? style : null);
const blur = webOnly({ backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" });
const fade = webOnly({ transition: "width 0.22s ease" });

/**
 * The floating pill of the phone shell (CHG-0760): the three tabs over the content, the lit one with its name, and the
 * Chronicle's Attention count on its tab. It shrinks to a circle at the window's left while the owner scrolls down; the
 * circle brings the pill back when pressed.
 */
export function PhonePill({
  active,
  client,
  isCollapsed,
  onExpand,
  onSelect,
}: {
  /** The lit tab, or null on a screen that belongs to none. */
  active: PhoneTab | null;
  client: ServiceClient;
  isCollapsed: boolean;
  onExpand: () => void;
  onSelect: (tab: PhoneTab) => void;
}) {
  // What the Chronicle's badge counts: the updates the owner has not read, as the sidebar's badge does (CHG-0569).
  const { data: chronicle } = useServiceQuery(client, { _tag: "ReadChronicle" }, "chronicle-menu-badge");
  const unreadCount = unreadCountOf(chronicle ?? []);
  const badge = unreadCount > 0 && (
    <View style={local.badge}>
      <Text style={local.badgeText}>{unreadCount}</Text>
    </View>
  );
  return (
    <View pointerEvents="box-none" style={local.anchor}>
      <View
        accessibilityLabel="Tabs"
        accessibilityRole="tablist"
        style={[local.pill, blur, fade, isCollapsed ? local.pillCollapsed : local.pillOpen]}
      >
        {isCollapsed ? (
          <Pressable
            accessibilityLabel={unreadCount > 0 ? `Show the tabs, ${unreadCount} unread` : "Show the tabs"}
            accessibilityRole="button"
            onPress={onExpand}
            style={local.circle}
          >
            <PhoneIcon color={colors.accentText} name={active ?? "grid"} />
            {badge}
          </Pressable>
        ) : (
          phoneTabs.map((tab) => {
            const isActive = tab.id === active;
            return (
              <Pressable
                accessibilityLabel={
                  tab.id === "chronicle" && unreadCount > 0 ? `Chronicle, ${unreadCount} unread` : tab.label
                }
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                key={tab.id}
                onPress={() => onSelect(tab.id)}
                style={[local.tab, isActive && local.tabActive]}
              >
                <View>
                  <PhoneIcon color={isActive ? colors.accentText : colors.textMuted} name={tab.id} />
                  {tab.id === "chronicle" && badge}
                </View>
                {isActive && <Text style={local.tabLabel}>{tab.label}</Text>}
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  // The strip the pill floats in: it spans the window's width above the bottom gap and leaves the content beneath its
  // empty parts to the touch.
  anchor: { bottom: pillBottom, left: 12, position: "absolute", right: 12 },
  badge: {
    alignItems: "center",
    backgroundColor: colors.marker,
    borderColor: colors.accentText,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 15,
    paddingHorizontal: 3,
    position: "absolute",
    right: -8,
    top: -6,
  },
  badgeText: { color: colors.accentText, fontFamily: fonts.sans, fontSize: 9, fontWeight: "600" },
  circle: { alignItems: "center", flex: 1, justifyContent: "center" },
  pill: {
    alignItems: "stretch",
    backgroundColor: withOpacity(colors.page, 0.92),
    borderColor: colors.edge,
    borderRadius: pillHeight / 2,
    borderWidth: 1,
    elevation: 6,
    flexDirection: "row",
    height: pillHeight,
    overflow: "visible",
    paddingHorizontal: 6,
    shadowColor: colors.shadow,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
  },
  pillCollapsed: { paddingHorizontal: 0, width: pillHeight },
  pillOpen: { width: "100%" },
  tab: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginVertical: 6,
  },
  tabActive: { backgroundColor: colors.accentSoft, borderRadius: radii.pill, flex: 1.9 },
  tabLabel: { color: colors.accentText, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "600" },
});

import { type ReactNode, useEffect, useRef } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { unreadCountOf } from "./chronicleFeed";
import { PhoneIcon, type PhoneIconName } from "./phoneIcons";
import { barSlotsOf, type ChoosingTab, type PhoneSelection } from "./phoneSelection";
import { barBottomGap, barHeight, type PhoneTab, phoneTabs, withOpacity } from "./phoneShell";

/** The gap under the bar: the larger one on a phone, whose home bar or gesture area lies at the window's edge. */
export const barBottom = Platform.OS === "web" ? barBottomGap.web : barBottomGap.native;

/** How long a tab is held before it opens its sheet (CHG-0773). */
const holdMilliseconds = 500;
const growMilliseconds = 360;
const chronicleWidth = 58;
const tabWidth = 76;

const webOnly = (style: object) => (Platform.OS === "web" ? style : null);

// A browser can blur what the bar floats over; React Native has no such blur, so the translucent ground alone does it
// elsewhere.
const blur = webOnly({ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" });

const tabLabelOf = (id: PhoneTab) => phoneTabs.find((entry) => entry.id === id)?.label ?? id;

/** Accessibility label for the Chronicle tab, naming unread items when there are any. */
export const chronicleLabelOf = (unreadCount: number) =>
  unreadCount > 0 ? `${tabLabelOf("chronicle")}, ${unreadCount} unread` : tabLabelOf("chronicle");

// Web browsers select text or open a context menu on a half-second press unless suppressed on holdable tabs.
const noHoldSelect = webOnly({ userSelect: "none", WebkitTouchCallout: "none" });

/**
 * A place on the bar that grows in and out: its width, opacity and size follow one animated value, so the bar widens
 * smoothly around its centre when the owner's choice adds a tab, and narrows when it takes one away.
 */
function Slot({ children, isShown, width }: { children: ReactNode; isShown: boolean; width: number }) {
  const progress = useRef(new Animated.Value(isShown ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      duration: growMilliseconds,
      easing: Easing.out(Easing.cubic),
      toValue: isShown ? 1 : 0,
      useNativeDriver: false,
    }).start();
  }, [isShown, progress]);
  return (
    <Animated.View
      pointerEvents={isShown ? "auto" : "none"}
      style={{
        opacity: progress,
        overflow: "hidden",
        transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
        width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, width] }),
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * One tab. A tab that chooses something fills a line along its foot while it is held and opens its sheet when the line
 * reaches the end; a shorter press is a tap.
 */
function BarTab({
  badge,
  icon,
  isLit,
  label,
  name,
  onHold,
  onTap,
  width,
}: {
  badge?: number;
  icon: PhoneIconName;
  isLit: boolean;
  /** The words under the icon; the Chronicle shows its icon alone. */
  label: string | null;
  /** What assistive technology reads. */
  name: string;
  /** Held for half a second; none for a tab that chooses nothing. */
  onHold?: () => void;
  onTap: () => void;
  width: number;
}) {
  const hold = useRef(new Animated.Value(0)).current;
  const startHold = () => {
    if (onHold === undefined) return;
    hold.setValue(0);
    Animated.timing(hold, {
      duration: holdMilliseconds,
      easing: Easing.linear,
      toValue: 1,
      useNativeDriver: false,
    }).start();
  };
  const endHold = () => {
    hold.stopAnimation();
    hold.setValue(0);
  };
  return (
    <Pressable
      {...(onHold === undefined ? {} : { accessibilityHint: "Hold to choose another" })}
      accessibilityLabel={name}
      accessibilityRole="tab"
      accessibilityState={{ selected: isLit }}
      delayLongPress={holdMilliseconds}
      onLongPress={onHold}
      onPress={onTap}
      onPressIn={startHold}
      onPressOut={endHold}
      style={[local.tab, { width }, isLit && local.tabLit, onHold !== undefined && noHoldSelect]}
    >
      <View>
        <PhoneIcon color={isLit ? colors.accentText : colors.textMuted} name={icon} size={24} />
        {badge !== undefined && badge > 0 && (
          <View style={local.badge}>
            <Text style={local.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      {label !== null && <Text style={[local.label, isLit && local.labelLit]}>{label}</Text>}
      <Animated.View
        pointerEvents="none"
        style={[local.fill, { width: hold.interpolate({ inputRange: [0, 1], outputRange: [0, width * 0.56] }) }]}
      />
    </Pressable>
  );
}

/**
 * The floating bar of the phone shell (CHG-0773): the Chronicle and Realms tabs, and the Quests and Errands tabs that
 * grow in once a realm and a quest are chosen. A tap shows a tab's choice, or opens its sheet while there is none; a hold
 * opens the sheet to change it. The Quests tab shows two swords until a quest is chosen, then one.
 */
export function PhoneBar({
  client,
  onChronicle,
  onHold,
  onTap,
  selection,
  tab,
}: {
  client: ServiceClient;
  onChronicle: () => void;
  onHold: (tab: ChoosingTab) => void;
  onTap: (tab: ChoosingTab) => void;
  selection: PhoneSelection;
  /** The lit tab, or null on a screen that belongs to none. */
  tab: PhoneTab | null;
}) {
  // What the Chronicle's badge counts: the updates the owner has not read, as the sidebar's badge does (CHG-0569).
  const { data: chronicle } = useServiceQuery(client, { _tag: "ReadChronicle" }, "chronicle-menu-badge");
  const unreadCount = unreadCountOf(chronicle ?? []);
  const { hasErrands, hasQuests } = barSlotsOf(selection);
  return (
    <View pointerEvents="box-none" style={local.anchor}>
      <View accessibilityLabel="Tabs" accessibilityRole="tablist" style={[local.bar, blur]}>
        <Slot isShown width={chronicleWidth}>
          <BarTab
            badge={unreadCount}
            icon="chronicle"
            isLit={tab === "chronicle"}
            label={null}
            name={chronicleLabelOf(unreadCount)}
            onTap={onChronicle}
            width={chronicleWidth}
          />
        </Slot>
        <Slot isShown width={tabWidth}>
          <BarTab
            icon="realms"
            isLit={tab === "realms"}
            label={tabLabelOf("realms")}
            name={tabLabelOf("realms")}
            onHold={() => onHold("realms")}
            onTap={() => onTap("realms")}
            width={tabWidth}
          />
        </Slot>
        <Slot isShown={hasQuests} width={tabWidth}>
          <BarTab
            icon={selection.quest === null ? "swords" : "sword"}
            isLit={tab === "quests"}
            label={tabLabelOf("quests")}
            name={tabLabelOf("quests")}
            onHold={() => onHold("quests")}
            onTap={() => onTap("quests")}
            width={tabWidth}
          />
        </Slot>
        <Slot isShown={hasErrands} width={tabWidth}>
          <BarTab
            icon="errands"
            isLit={tab === "errands"}
            label={tabLabelOf("errands")}
            name={tabLabelOf("errands")}
            onHold={() => onHold("errands")}
            onTap={() => onTap("errands")}
            width={tabWidth}
          />
        </Slot>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  // The strip the bar floats in: it spans the window above the bottom gap and leaves the content beneath its empty
  // parts to the touch.
  anchor: { alignItems: "center", bottom: barBottom, left: 12, position: "absolute", right: 12 },
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
  bar: {
    backgroundColor: withOpacity(colors.page, 0.92),
    borderColor: colors.edge,
    borderRadius: barHeight / 2,
    borderWidth: 1,
    elevation: 6,
    flexDirection: "row",
    height: barHeight,
    padding: 5,
    shadowColor: colors.shadow,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
  },
  fill: { backgroundColor: colors.accentText, borderRadius: 2, bottom: 5, height: 3, position: "absolute" },
  label: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.xs, fontWeight: "600" },
  labelLit: { color: colors.accentText },
  tab: { alignItems: "center", borderRadius: radii.pill, flex: 1, gap: 3, justifyContent: "center" },
  tabLit: { backgroundColor: colors.accentSoft },
});

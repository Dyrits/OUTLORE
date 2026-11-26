import { useContext, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { HostMenuContext } from "../foundation/hostContext";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { menuPlaces, type Place } from "./placeCatalog";

const widest = 320;

/** The places of the Keep, which the side menu groups apart from the others. */
const keepPlaces: ReadonlyArray<Place> = ["Lore", "Archived"];

/**
 * The narrow window's side menu (CHG-0773): it slides in from the left over the screen, over a scrim that closes it,
 * and holds the hosts to choose from (the computer and every paired host, with a way to pair another) and the places
 * the bar leaves out: the Keep (Lore, Archive), Reserves and Settings.
 */
export function SideMenu({
  isOpen,
  onClose,
  onOpen,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpen: (place: Place) => void;
}) {
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(widest, Math.round(width * 0.82));
  const slide = useRef(new Animated.Value(isOpen ? 1 : 0)).current;
  const [isMounted, setMounted] = useState(isOpen);
  useEffect(() => {
    if (isOpen) setMounted(true);
    Animated.timing(slide, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
      toValue: isOpen ? 1 : 0,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !isOpen) setMounted(false);
    });
  }, [isOpen, slide]);
  const hostMenu = useContext(HostMenuContext);
  if (!isMounted) return null;
  const renderPlaces = (isWanted: (place: Place) => boolean) =>
    menuPlaces
      .filter((entry) => isWanted(entry.place))
      .map((entry) => (
        <Pressable
          accessibilityLabel={`${entry.label}. ${entry.note}`}
          accessibilityRole="button"
          key={entry.place}
          onPress={() => onOpen(entry.place)}
          style={({ pressed }) => [local.row, pressed && local.rowPressed]}
        >
          <Text style={local.rowText}>{entry.label}</Text>
          <Text style={local.note}>{entry.note}</Text>
        </Pressable>
      ));
  return (
    <View pointerEvents="box-none" style={local.layer}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: slide }]}>
        <Pressable
          accessibilityLabel="Close the menu"
          accessibilityRole="button"
          onPress={onClose}
          style={local.scrim}
        />
      </Animated.View>
      <Animated.View
        accessibilityLabel="Menu"
        style={[
          local.panel,
          {
            transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-panelWidth, 0] }) }],
            width: panelWidth,
          },
        ]}
      >
        <ScrollView contentContainerStyle={local.scrollContent} showsVerticalScrollIndicator={false}>
          {hostMenu !== null && (
            <>
              <Text style={local.heading}>Hosts</Text>
              {hostMenu.hasLocalComputer && (
                <HostRow
                  isActive={hostMenu.activeId === null}
                  label={hostMenu.computerName}
                  note="This computer"
                  onPress={() => {
                    onClose();
                    hostMenu.onChoose(null);
                  }}
                />
              )}
              {hostMenu.hosts.map((host) => (
                <HostRow
                  isActive={host.id === hostMenu.activeId}
                  key={host.id}
                  label={host.name}
                  note="Paired host"
                  onPress={() => {
                    onClose();
                    hostMenu.onChoose(host.id);
                  }}
                />
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  hostMenu.onAdd();
                }}
                style={({ pressed }) => [local.row, pressed && local.rowPressed]}
              >
                <Text style={local.rowText}>＋ Add a host</Text>
              </Pressable>
            </>
          )}
          <Text style={local.heading}>The Keep</Text>
          {renderPlaces((place) => keepPlaces.includes(place))}
          <Text style={local.heading}>More</Text>
          {renderPlaces((place) => !keepPlaces.includes(place))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function HostRow({
  isActive,
  label,
  note,
  onPress,
}: {
  isActive: boolean;
  label: string;
  note: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      style={({ pressed }) => [local.row, isActive && local.rowActive, pressed && local.rowPressed]}
    >
      <View style={[local.dot, isActive && local.dotActive]} />
      <View style={local.hostText}>
        <Text numberOfLines={1} style={local.rowText}>
          {label}
        </Text>
        <Text style={local.note}>{note}</Text>
      </View>
    </Pressable>
  );
}

const local = StyleSheet.create({
  dot: { backgroundColor: colors.borderStrong, borderRadius: radii.pill, height: 9, width: 9 },
  dotActive: { backgroundColor: colors.success },
  heading: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.xs,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 4,
    marginTop: 18,
    paddingHorizontal: 8,
    textTransform: "uppercase",
  },
  hostText: { flex: 1 },
  layer: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0, zIndex: 30 },
  note: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  panel: {
    backgroundColor: colors.page,
    borderBottomRightRadius: 26,
    borderColor: colors.edge,
    borderRightWidth: 1,
    borderTopRightRadius: 26,
    bottom: 0,
    elevation: 16,
    left: 0,
    position: "absolute",
    shadowColor: colors.shadow,
    shadowOffset: { height: 0, width: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    top: 0,
  },
  row: {
    alignItems: "center",
    borderRadius: radii.xl,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: 10,
  },
  rowActive: { backgroundColor: colors.accentSoft },
  rowPressed: { backgroundColor: colors.controlHover },
  rowText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  scrim: { backgroundColor: "rgba(15,18,26,0.38)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  scrollContent: { paddingBottom: 24, paddingHorizontal: 14, paddingTop: 28 },
});

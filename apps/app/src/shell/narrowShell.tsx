import type { Dispatch, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { PillScrollContext } from "../foundation/pillScroll";
import { colors } from "../foundation/theme";
import type { Location, NavigationEvent } from "./location";
import { MenuScreen } from "./menuScreen";
import { PhonePill, pillBottom } from "./phonePill";
import { initialPillScroll, phoneShellOf, phoneTabEventOf, pillClearanceOf, pillScrollOf } from "./phoneShell";
import { Sidebar, type SidebarProps } from "./sidebar";
import { type DetailsToggle, NarrowTopBar } from "./topBar";

/**
 * The phone's frame (CHG-0760): a top bar over the content, which the Menu, the Quests tab and Chronicler each cover as a
 * full screen of their own, and the floating pill of the three tabs over it all. In a quest or errand the pill gives
 * way to the conversation's own composer. A quest panel, the Menu, the Quests tab and Chronicler take the content's
 * place while it stays mounted beneath, so the open conversation and its draft are kept.
 */
export function NarrowShell({
  chronicler,
  children,
  client,
  details,
  dispatch,
  location,
  panelColumn,
  showsDetails,
  sidebarProps,
}: {
  /** Chronicler's chat, shown on the Chronicler tab. */
  chronicler: ReactNode;
  children: ReactNode;
  client: ServiceClient;
  details: DetailsToggle | null;
  dispatch: Dispatch<NavigationEvent>;
  location: Location;
  /** The quest panel, shown in the content's place while it is open. */
  panelColumn: ReactNode;
  showsDetails: boolean;
  sidebarProps: Omit<SidebarProps, "hasLeftDivider" | "host" | "width">;
}) {
  const shell = phoneShellOf(location, showsDetails);
  const clearance = pillClearanceOf(pillBottom);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const scroll = useRef(initialPillScroll);
  const offset = useRef(0);
  const report = useCallback((next: number) => {
    offset.current = next;
    scroll.current = pillScrollOf(scroll.current, next);
    setIsCollapsed(scroll.current.isCollapsed);
  }, []);
  // Another screen starts at its top with the whole pill.
  const screenKey = `${shell.cover}:${shell.tab}:${location.place}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key is the screen the pill resets for.
  useEffect(() => {
    scroll.current = initialPillScroll;
    offset.current = 0;
    setIsCollapsed(false);
  }, [screenKey]);
  const expand = useCallback(() => {
    scroll.current = { anchor: offset.current, isCollapsed: false };
    setIsCollapsed(false);
  }, []);
  const pillScroll = useMemo(
    () => (shell.bottom === "pill" ? { clearance, report } : null),
    [clearance, report, shell.bottom],
  );
  const isCovered = shell.cover !== null || showsDetails;
  return (
    <PillScrollContext.Provider value={pillScroll}>
      <View style={local.narrow}>
        <NarrowTopBar
          details={location.ritualForm === null && shell.cover === null ? details : null}
          isMenuOpen={location.isMenuOpen}
          onBack={shell.hasBack ? () => dispatch({ isOpen: true, type: "menu" }) : null}
          onMenu={() => dispatch({ isOpen: !location.isMenuOpen, type: "menu" })}
          title={shell.title}
        />
        <View style={local.body}>
          <View
            style={[
              local.content,
              isCovered && local.hidden,
              shell.isClearOfPill && shell.cover === null && { paddingBottom: clearance },
            ]}
          >
            {children}
          </View>
          {shell.cover === "menu" && (
            <View style={local.content}>
              <MenuScreen onOpen={(place) => dispatch({ place, type: "place" })} />
            </View>
          )}
          {shell.cover === "quests" && (
            <View style={[local.content, local.questsScreen]}>
              <Sidebar {...sidebarProps} host="narrow" width="100%" />
            </View>
          )}
          {shell.cover === "chronicler" && (
            <View style={[local.content, { paddingBottom: clearance }]}>{chronicler}</View>
          )}
          {shell.cover === null && showsDetails && panelColumn}
          {shell.bottom === "pill" && (
            <PhonePill
              active={shell.tab}
              client={client}
              isCollapsed={isCollapsed}
              onExpand={expand}
              onSelect={(tab) => dispatch(phoneTabEventOf(tab))}
            />
          )}
        </View>
      </View>
    </PillScrollContext.Provider>
  );
}

const local = StyleSheet.create({
  body: { flex: 1 },
  content: { flex: 1 },
  hidden: { display: "none" },
  narrow: { backgroundColor: colors.page, flex: 1 },
  // A row, so the sidebar stretches to the screen's height, as in the wide frame.
  questsScreen: { flexDirection: "row" },
});

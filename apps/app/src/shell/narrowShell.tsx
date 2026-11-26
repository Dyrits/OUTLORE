import type { Dispatch, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { BarClearanceContext } from "../foundation/barClearance";
import type { ServiceClient } from "../foundation/client";
import { useKeyboardHeight } from "../foundation/keyboardHeight";
import { allMissions, listedMissions } from "../foundation/queries";
import { type PhoneHeader, PhoneHeaderSetter } from "../foundation/shellContext";
import { colors } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import type { Location, NavigationEvent } from "./location";
import { barBottom, PhoneBar } from "./phoneBar";
import { choiceTitleOf, errandChoicesOf, questChoicesOf, realmChoicesOf } from "./phoneChoices";
import { PhoneChooser } from "./phoneChooser";
import {
  type Choice,
  type ChoiceKind,
  type ChoosingTab,
  chosenEventOf,
  emptySelection,
  heldChoiceOf,
  questRealmOf,
  reconcileSelection,
  selectionOf,
  tappedTabOf,
} from "./phoneSelection";
import { barClearanceOf, chronicleEvent, phoneBackOf, phoneShellOf } from "./phoneShell";
import { placementsOf } from "./questTree";
import { SideMenu } from "./sideMenu";
import { type DetailsToggle, NarrowTopBar } from "./topBar";

/**
 * The phone's frame (CHG-0773): a top bar over the content, and the floating bar of tabs over it all. The bar grows as
 * the owner chooses: the Chronicle and Realms tabs, then Quests once a realm is chosen and Errands once a quest is. A
 * choice lands in that one's chat, whose composer sits above the bar; a tab is tapped to show its choice and held to
 * change it. The side menu holds the hosts and the places the bar leaves out. The quest panel and the side menu take
 * the content's place or lie over it while the open conversation stays mounted, so it and its draft are kept.
 */
export function NarrowShell({
  children,
  client,
  details,
  dispatch,
  location,
  panelColumn,
  showsDetails,
}: {
  children: ReactNode;
  client: ServiceClient;
  details: DetailsToggle | null;
  dispatch: Dispatch<NavigationEvent>;
  location: Location;
  /** The quest panel, shown in the content's place while it is open. */
  panelColumn: ReactNode;
  showsDetails: boolean;
}) {
  const shell = phoneShellOf(location, showsDetails);
  const isKeyboardOpen = useKeyboardHeight() > 0;
  const isBarShown = shell.hasBar && !isKeyboardOpen;
  const clearance = barClearanceOf(barBottom);
  // The realm, quest and errand the bar holds follow the screen on show, and stay while another screen shows.
  const { data: listed } = useServiceQuery(client, listedMissions.request, listedMissions.key);
  const questRealm = questRealmOf(listed?.missions.find((mission) => mission.id === location.openMission) ?? null);
  const [selection, setSelection] = useState(emptySelection);
  const [chooser, setChooser] = useState<ChoiceKind | null>(null);
  const [header, setHeader] = useState<PhoneHeader | null>(null);
  // The sheet closes whenever another screen or the side menu comes on show.
  const { isMenuOpen, listedRealm, openMission, openThread, place } = location;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the screen or side menu on show is what closes the sheet.
  useEffect(() => setChooser(null), [isMenuOpen, listedRealm, openMission, openThread, place]);
  const { data: everything } = useServiceQuery(
    client,
    chooser === "realm" || chooser === "quest" ? allMissions.request : null,
    allMissions.key,
  );
  const { data: questDetail } = useServiceQuery(
    client,
    chooser === "errand" && selection.quest !== null
      ? { _tag: "ReadMission", missionId: selection.quest, threadId: null }
      : null,
    `${selection.quest}:top`,
  );
  const followed = selectionOf(selection, location, questRealm);
  const reconciled =
    listed === null
      ? followed
      : reconcileSelection(
          followed,
          listed,
          location,
          questDetail === null ? null : { missionId: questDetail.mission.id, threads: questDetail.threads },
        );
  if (reconciled !== selection) setSelection(reconciled);
  const choices = useMemo(() => {
    if (chooser === "errand") return errandChoicesOf(questDetail?.threads ?? [], selection);
    if (everything === null) return [];
    const placements = placementsOf(everything.missions, everything.workspaces);
    return chooser === "realm" ? realmChoicesOf(placements, selection) : questChoicesOf(placements, selection);
  }, [chooser, everything, questDetail, selection]);
  const tapTab = (tab: ChoosingTab) => {
    const result = tappedTabOf(tab, selection, shell.tab);
    if (result.kind === "dismiss") setChooser(null);
    else if (result.kind === "navigate") {
      setChooser(null);
      dispatch(result.event);
    } else setChooser(result.choice);
  };
  const choose = (choice: Choice) => {
    setChooser(null);
    const event = chosenEventOf(choice, selection);
    if (event !== null) dispatch(event);
  };
  // The phone's Back goes to the screen before, and leaves the app only from the Chronicle.
  const backRef = useRef({ chooser, details, dispatch, location, selection, showsDetails });
  backRef.current = { chooser, details, dispatch, location, selection, showsDetails };
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      const current = backRef.current;
      const back = phoneBackOf(
        current.location,
        current.showsDetails,
        current.selection.realm,
        current.chooser !== null,
      );
      if (back === null) return false;
      if (back.type === "closeChooser") setChooser(null);
      else if (back.type === "closeDetails") current.details?.onToggle();
      else current.dispatch(back);
      return true;
    });
    return () => subscription.remove();
  }, []);
  return (
    <PhoneHeaderSetter.Provider value={setHeader}>
      <BarClearanceContext.Provider value={isBarShown && !shell.isClearOfBar ? clearance : 0}>
        <View style={local.narrow}>
          <NarrowTopBar
            details={
              location.ritualForm === null && !location.isErrandStarterOpen && location.openThread === null
                ? details
                : null
            }
            header={showsDetails || location.isErrandStarterOpen ? null : header}
            isMenuOpen={location.isMenuOpen}
            onMenu={() => {
              if (!location.isMenuOpen) setChooser(null);
              dispatch({ isOpen: !location.isMenuOpen, type: "menu" });
            }}
            title={shell.title}
          />
          <View style={local.body}>
            <View
              style={[
                local.content,
                showsDetails && local.hidden,
                shell.isClearOfBar && isBarShown && { paddingBottom: clearance },
              ]}
            >
              {children}
            </View>
            {showsDetails && panelColumn}
            {isBarShown && (
              <PhoneBar
                client={client}
                onChronicle={() => {
                  setChooser(null);
                  dispatch(chronicleEvent);
                }}
                onHold={(tab) => setChooser(heldChoiceOf(tab, selection))}
                onTap={tapTab}
                selection={selection}
                tab={shell.tab}
              />
            )}
            {isBarShown && chooser !== null && (
              <PhoneChooser
                choices={choices}
                onChoose={choose}
                onClose={() => setChooser(null)}
                title={choiceTitleOf(chooser, selection, questDetail?.mission.title ?? null)}
              />
            )}
          </View>
          <SideMenu
            isOpen={location.isMenuOpen}
            onClose={() => dispatch({ isOpen: false, type: "menu" })}
            onOpen={(next) => dispatch({ place: next, type: "place" })}
          />
        </View>
      </BarClearanceContext.Provider>
    </PhoneHeaderSetter.Provider>
  );
}

const local = StyleSheet.create({
  body: { flex: 1 },
  content: { flex: 1 },
  hidden: { display: "none" },
  narrow: { backgroundColor: colors.page, flex: 1 },
});

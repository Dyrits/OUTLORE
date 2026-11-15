import type { MissionId, ThreadId } from "@outlore/contracts";
import { useEffect, useMemo, useReducer } from "react";
import { Pressable, Text, View } from "react-native";
import { ArchiveNavigation } from "./src/foundation/archiveNavigation";
import { applyAppearance, rememberPlace, resumedPlace } from "./src/foundation/colorScheme";
import { ActiveHostContext, HostMenuContext } from "./src/foundation/hostContext";
import { PageNavigation } from "./src/foundation/pageNavigation";
import { colors } from "./src/foundation/theme";
import { useHostConnection } from "./src/foundation/useHostConnection";
import { useRightPanel } from "./src/foundation/useRightPanel";
import type { SettingsSectionId } from "./src/settings/settingsSections";
import { AddHostModal } from "./src/shell/addHostModal";
import { AppScreen } from "./src/shell/appScreen";
import { appStyles as styles } from "./src/shell/appStyles";
import { initialLocation, navigate, panelScopeOf } from "./src/shell/location";
import { detailsModeOf } from "./src/shell/navigation";
import { useAttentionNotice } from "./src/shell/notifications";
import type { RealmListing } from "./src/shell/questTree";
import { Shell } from "./src/shell/shell";
import type { Place } from "./src/shell/sidebar";

export default function App() {
  const {
    isBrowser,
    pair,
    hostId,
    setHostId,
    hostClient,
    hosts,
    computerName,
    isAddingHost,
    setIsAddingHost,
    linkFailure,
    client,
    failure,
    setFailure,
    activeHost,
  } = useHostConnection();
  const [location, dispatch] = useReducer(navigate, resumedPlace, initialLocation);
  const {
    openMission,
    openThread,
    selectedMission,
    listedRealm,
    place,
    settingsSection,
    isPermissionsOpen,
    guildmasterRealm,
    openCount,
  } = location;
  const setGuildmasterRealm = (path: string | null) => dispatch({ path, type: "chroniclerRealm" });
  const setIsPermissionsOpen = (isOpen: boolean) => dispatch({ isOpen, type: "permissions" });
  const setSettingsSection = (section: SettingsSectionId) => dispatch({ section, type: "section" });
  const setOpenThread = (id: ThreadId | null) => {
    if (openMission !== null) dispatch({ id, missionId: openMission, type: "thread" });
  };
  const rightPanel = useRightPanel(hostId, panelScopeOf(location));
  useAttentionNotice(client);

  useEffect(() => rememberPlace(place), [place]);
  // The browser's own chrome, the page behind the app, and the Dock's icon follow the theme and look in use.
  useEffect(() => applyAppearance(colors.ground), []);
  const hostMenu = useMemo(
    () => ({
      activeId: hostId,
      computerName,
      hasLocalComputer: !isBrowser,
      hosts,
      onAdd: () => setIsAddingHost(true),
      onChoose: (next: string | null) => {
        // Another computer's quests are not this one's: nothing open stays open.
        dispatch({ type: "host" });
        setFailure(null);
        setHostId(next);
      },
    }),
    [computerName, hostId, hosts, isBrowser, setFailure, setHostId, setIsAddingHost],
  );
  // A browser with no host has nothing to show: it pairs first.
  if (isBrowser && hosts.length === 0) {
    return (
      <View style={styles.center}>
        <AddHostModal
          computerName={computerName}
          deviceNoun="browser"
          isRequired
          onPair={(code, deviceName) =>
            pair(code, deviceName).then((host) => {
              hostMenu.onChoose(host.id);
              return host;
            })
          }
        />
      </View>
    );
  }
  if (client === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.connecting}>
          {failure ?? (hostId === null ? "Connecting to the local service…" : `Connecting to ${activeHost.name}…`)}
        </Text>
        {hostId !== null && !isBrowser && (
          <Pressable accessibilityRole="button" onPress={() => hostMenu.onChoose(null)} style={styles.backButton}>
            <Text style={styles.backText}>Back to this computer</Text>
          </Pressable>
        )}
      </View>
    );
  }
  const goTo = (place: Place) => dispatch({ place, type: "place" });
  const openMissionFromAnywhere = (id: MissionId) => dispatch({ id, type: "quest" });
  const openSideQuest = (missionId: MissionId, id: ThreadId) => dispatch({ id, missionId, type: "thread" });
  const selectMission = (id: MissionId | null) => {
    dispatch({ id, type: "select" });
    rightPanel.show(id === null ? null : { tab: "quest" });
  };
  const openRealm = (listing: RealmListing) => dispatch({ listing, type: "realm" });
  const openParent = (quest: { workspaceId: string | null; workspaceName: string | null }) =>
    dispatch({ quest, type: "parent" });
  const detailsMode = detailsModeOf({ hasListedRealm: listedRealm !== null, openMission, place, selectedMission });
  const details =
    detailsMode === "toggle"
      ? {
          isOpen: rightPanel.content?.tab === "quest",
          onToggle: () => rightPanel.show(rightPanel.content?.tab === "quest" ? null : { tab: "quest" }),
        }
      : null;
  const shell = (
    <Shell
      chronicler={{ onRealm: setGuildmasterRealm, realmPath: guildmasterRealm }}
      client={client}
      details={details}
      dispatch={dispatch}
      listedRealm={listedRealm}
      location={location}
      onOpenMission={openMissionFromAnywhere}
      onOpenRealmQuests={openRealm}
      onOpenThread={openSideQuest}
      onPlace={goTo}
      openMission={openMission}
      openThread={openThread}
      place={place}
      rightPanel={rightPanel}
    >
      <AppScreen
        client={client}
        navigation={{
          closeMission: () => dispatch({ type: "close" }),
          goTo,
          openMission: openMissionFromAnywhere,
          openParent,
          openRealm,
          openThread: openSideQuest,
          selectMission,
          selectThread: setOpenThread,
          setGuildmasterRealm,
          setPermissions: setIsPermissionsOpen,
          setSettingsSection,
          showDetails: (isOpen) => rightPanel.show(isOpen ? { tab: "quest" } : null),
        }}
        view={{
          isPermissionsOpen,
          listedRealm,
          openCount,
          openMission,
          openThread,
          place,
          selectedMission,
          settingsSection,
        }}
      />
    </Shell>
  );
  return (
    <ActiveHostContext.Provider value={activeHost}>
      <HostMenuContext.Provider value={hostMenu}>
        <View style={styles.root}>
          {hostId !== null && linkFailure !== null && (
            <View accessibilityRole="alert" style={styles.banner}>
              <Text numberOfLines={2} style={styles.bannerText}>
                {activeHost.name}: {linkFailure}
                {hostClient?.hasGivenUp === true ? "" : " Trying again…"}
              </Text>
              {isBrowser ? (
                hostClient?.needsPairing === true && (
                  <Pressable accessibilityRole="button" onPress={() => setIsAddingHost(true)}>
                    <Text style={styles.bannerLink}>Pair again</Text>
                  </Pressable>
                )
              ) : (
                <Pressable accessibilityRole="button" onPress={() => hostMenu.onChoose(null)}>
                  <Text style={styles.bannerLink}>Use this computer</Text>
                </Pressable>
              )}
            </View>
          )}
          <ArchiveNavigation.Provider
            value={{
              quest: openParent,
              realm: () => goTo("Realms"),
            }}
          >
            <PageNavigation.Provider
              value={{
                isChroniclerBudgetOpen: location.isChroniclerBudgetOpen,
                onChroniclerBudget: (isOpen) => dispatch({ isOpen, type: "chroniclerBudget" }),
                onPage: (page) => dispatch({ page, type: "page" }),
                page: location.page,
              }}
            >
              <View style={styles.root}>{shell}</View>
            </PageNavigation.Provider>
          </ArchiveNavigation.Provider>
        </View>
        {isAddingHost && (
          <AddHostModal
            computerName={computerName}
            deviceNoun={isBrowser ? "browser" : "computer"}
            onCancel={() => setIsAddingHost(false)}
            onPair={(code, deviceName) =>
              pair(code, deviceName).then((host) => {
                setIsAddingHost(false);
                hostMenu.onChoose(host.id);
                return host;
              })
            }
          />
        )}
      </HostMenuContext.Provider>
    </ActiveHostContext.Provider>
  );
}

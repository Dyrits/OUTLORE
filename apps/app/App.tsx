import type { MissionId, ThreadId } from "@outlore/contracts";
import { useEffect, useMemo, useReducer } from "react";
import { Pressable, Text, View } from "react-native";
import { startAndroidUpdates } from "./src/foundation/androidUpdates/platform";
import { ArchiveNavigation } from "./src/foundation/archiveNavigation";
import { applyAppearance, rememberPlace, resumedPlace } from "./src/foundation/colorScheme";
import { ActiveHostContext, HostMenuContext } from "./src/foundation/hostContext";
import { useKeyboardHeight } from "./src/foundation/keyboardHeight";
import { PageNavigation } from "./src/foundation/pageNavigation";
import { colors } from "./src/foundation/theme";
import { useHostConnection } from "./src/foundation/useHostConnection";
import { useRightPanel } from "./src/foundation/useRightPanel";
import type { SettingsSectionId } from "./src/settings/settingsSections";
import { AddHostModal } from "./src/shell/addHostModal";
import { AppScreen } from "./src/shell/appScreen";
import { AppStatusBar } from "./src/shell/appStatusBar";
import { appStyles as styles } from "./src/shell/appStyles";
import { initialLocation, navigate, panelScopeOf } from "./src/shell/location";
import { detailsModeOf } from "./src/shell/navigation";
import { useAttentionNotice } from "./src/shell/notifications";
import type { RealmListing } from "./src/shell/questTree";
import { Shell } from "./src/shell/shell";
import type { Place } from "./src/shell/sidebar";
import { useWorkshopTrip } from "./src/shell/useWorkshopTrip";
import { HostUpdateOffer, UpdateNotice } from "./src/updates";

export function App() {
  const {
    isBrowser,
    pair,
    hostId,
    setHostId,
    hosts,
    computerName,
    deviceNoun,
    isAddingHost,
    setIsAddingHost,
    offer,
    client,
    setFailure,
    activeHost,
    status,
    retry,
    openUpdateLink,
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
  const onWorkshop = useWorkshopTrip({
    dispatch,
    isWorkshopOpen: place === "Settings" && openMission === null,
    panel: rightPanel,
  });
  useAttentionNotice(client);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => rememberPlace(place), [place]);
  useEffect(startAndroidUpdates, []);
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
  // Add a host, opened from the host menu or by a pairing link. It also shows over the screen that waits for a host, so a
  // link that opens the app while its host is unreachable is not lost.
  const addHostDialog = isAddingHost ? (
    <AddHostModal
      computerName={computerName}
      deviceNoun={deviceNoun}
      key={offer?.code ?? "manual"}
      offer={offer}
      onCancel={() => setIsAddingHost(false)}
      onPair={(code, deviceName) =>
        pair(code, deviceName).then((host) => {
          setIsAddingHost(false);
          hostMenu.onChoose(host.id);
          return host;
        })
      }
    />
  ) : null;
  // A browser with no host has nothing to show: it pairs first.
  if (status.kind === "pairing" || (status.canPair && isAddingHost)) {
    return (
      <View style={styles.center}>
        <AppStatusBar />
        <AddHostModal
          computerName={computerName}
          deviceNoun={deviceNoun}
          isRequired
          key={offer?.code ?? "manual"}
          offer={offer}
          onPair={(code, deviceName) =>
            pair(code, deviceName).then((host) => {
              setIsAddingHost(false);
              hostMenu.onChoose(host.id);
              retry();
              return host;
            })
          }
        />
      </View>
    );
  }
  if (status.kind === "connecting" || client === null) {
    return (
      <View style={styles.center}>
        <AppStatusBar />
        <Text style={styles.connecting}>{status.message}</Text>
        <UpdateNotice hasReleaseMismatch={status.hasReleaseMismatch} />
        {status.hasReleaseMismatch && <HostUpdateOffer key={hostId} onUpdated={retry} openLink={openUpdateLink} />}
        {status.canRetry && (
          <Pressable accessibilityRole="button" onPress={retry} style={styles.backButton}>
            <Text style={styles.backText}>Retry</Text>
          </Pressable>
        )}
        {status.canPair && (
          <Pressable accessibilityRole="button" onPress={() => setIsAddingHost(true)} style={styles.backButton}>
            <Text style={styles.backText}>Pair again</Text>
          </Pressable>
        )}
        {hosts
          .filter((host) => host.id !== hostId)
          .map((host) => (
            <Pressable
              accessibilityRole="button"
              key={host.id}
              onPress={() => hostMenu.onChoose(host.id)}
              style={styles.backButton}
            >
              <Text style={styles.backText}>Connect to {host.name}</Text>
            </Pressable>
          ))}
        {status.canUseComputer && (
          <Pressable accessibilityRole="button" onPress={() => hostMenu.onChoose(null)} style={styles.backButton}>
            <Text style={styles.backText}>Back to this computer</Text>
          </Pressable>
        )}
        {addHostDialog}
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
      isWorkshopOpen={place === "Settings" && location.openMission === null}
      listedRealm={listedRealm}
      location={location}
      onOpenChannel={(listing) => dispatch({ listing, type: "channel" })}
      onOpenChronicle={() => goTo("Chronicle")}
      onOpenMission={openMissionFromAnywhere}
      onOpenRealmQuests={openRealm}
      onOpenThread={openSideQuest}
      onWorkshop={onWorkshop}
      openMission={openMission}
      openThread={openThread}
      place={place}
      rightPanel={rightPanel}
    >
      <AppScreen
        client={client}
        navigation={{
          goTo,
          openChannel: (listing) => dispatch({ listing, type: "channel" }),
          openMenu: () => dispatch({ isOpen: true, type: "menu" }),
          openMission: openMissionFromAnywhere,
          openParent,
          openRealm,
          openThread: openSideQuest,
          selectMission,
          selectThread: setOpenThread,
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
          parkedChannel:
            place === "Settings" && location.workshopReturn?.place === "Channel"
              ? (location.workshopReturn.listedRealm ?? { id: null, name: "Borderlands" })
              : null,
          parkedQuest:
            place === "Settings" && location.openMission === null && location.workshopReturn?.openMission != null
              ? {
                  openCount: location.workshopReturn.openCount,
                  openMission: location.workshopReturn.openMission,
                  openThread: location.workshopReturn.openThread,
                }
              : null,
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
        <View style={[styles.screen, { paddingBottom: keyboardHeight }]}>
          <AppStatusBar />
          {status.failure !== null && (
            <View accessibilityRole="alert" style={styles.banner}>
              <Text numberOfLines={2} style={styles.bannerText}>
                {activeHost.name}: {status.failure}
                {status.isRetrying ? " Trying again…" : ""}
              </Text>
              {status.hasReleaseMismatch && <UpdateNotice hasReleaseMismatch />}
              {status.hasReleaseMismatch && (
                <HostUpdateOffer key={hostId} onUpdated={retry} openLink={openUpdateLink} />
              )}
              {status.canRetry && (
                <Pressable accessibilityRole="button" onPress={retry}>
                  <Text style={styles.bannerLink}>Retry</Text>
                </Pressable>
              )}
              {isBrowser ? (
                status.canPair && (
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
              realm: () => goTo("Home"),
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
        {addHostDialog}
      </HostMenuContext.Provider>
    </ActiveHostContext.Provider>
  );
}

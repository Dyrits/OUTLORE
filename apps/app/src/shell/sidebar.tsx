import type { MissionId, MissionSummary, ThreadId, WorkspaceId } from "@outlore/contracts";
import { useState } from "react";
import { type DimensionValue, Pressable, ScrollView, Text, View } from "react-native";
import { ReserveRows } from "../editors/budgets";
import { PlanLimitRings } from "../editors/planLimitRings";
import { messageOf, newRequestId, type ServiceClient } from "../foundation/client";
import { allMissions } from "../foundation/queries";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { MoveQuestModal } from "../quests/moveQuestModal";
import { type Destination, type MoveConfirmation, moveConfirmationOf } from "../quests/questMove";
import { NewRealmModal } from "../realms/newRealmModal";
import { realmLabelOf } from "../realms/realmLabels";
import { ActionMenu } from "../ui/actionMenu";
import { menuPlaces, type Place } from "./placeCatalog";
import { DropTarget } from "./questDrag";
import { placementsOf, type RealmListing, realmGroupsOf, toggledFold } from "./questTree";
import { railOutlineOf } from "./railOutline";
import { Quest, RealmHeader } from "./railQuests";
import { ShowAll } from "./railRows";
import { borderlandsShown, isHovered, local, realmShown } from "./railStyles";

export type { Place } from "./placeCatalog";

/** A set of ids the owner toggles, as the expanded and collapsed rows of the tree. */
const useToggles = () => {
  const [set, setSet] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => setSet((current) => toggledFold(current, id));
  return { set, setSet, toggle };
};

/**
 * The left sidebar (CHG-0449): the Realms title, which opens the overview; each realm with its quests; the quests that
 * are in no realm as ordinary rows; the buttons that visit a realm and start a quest; and at the foot the menu of the other
 * places. Quests nest their side-quests at every depth, and the sidebar opens the path to the thread that is open.
 */
export function Sidebar({
  client,
  width,
  onOpenMission,
  onOpenRealmQuests,
  onOpenThread,
  onPlace,
  openMission,
  openThread,
  place,
}: {
  client: ServiceClient;
  /** The open rail's width, as dragged; the whole width on a phone, where this is the menu screen. */
  width: DimensionValue;
  onOpenMission: (id: MissionId) => void;
  /** Opens the page that lists all of a realm's quests. */
  onOpenRealmQuests: (listing: RealmListing) => void;
  /** Opens a side-quest of a quest. */
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
  onPlace: (place: Place) => void;
  openMission: MissionId | null;
  /** The side-quest open in the open quest, or null for the quest itself. */
  openThread: ThreadId | null;
  place: Place | null;
}) {
  const { data } = useServiceQuery(client, allMissions.request, allMissions.key);
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const placements = placementsOf(data?.missions ?? [], data?.workspaces ?? []);
  const isHere = (each: Place) => openMission === null && place === each;
  // The menu that makes a realm, tied to a folder or to none.
  const [isCreating, setIsCreating] = useState(false);
  // Realms start open and quests start closed, so a long list of quests stays short; side-quests start open.
  const closedRealms = useToggles();
  // Realms, Borderlands, and The Keep fold under their headings, all the same way.
  const foldedSections = useToggles();
  const openQuests = useToggles();
  const collapsedThreads = useToggles();
  const outline = railOutlineOf(placements, openMission, openQuests.set, realmShown);
  const questProps = {
    client,
    collapsed: collapsedThreads.set,
    onOpenMission,
    onOpenThread,
    onToggle: openQuests.toggle,
    onToggleThread: collapsedThreads.toggle,
    openMission,
    openThread,
    shouldShowAgentThreads: settings?.shouldShowAgentThreads ?? true,
  };

  // Starts an empty quest and opens it; its realm unfolds to show it, and a refusal shows under the realm.
  const [newQuestFailure, setNewQuestFailure] = useState<{ message: string; groupId: string } | null>(null);
  const startQuest = (groupId: string, realmId: WorkspaceId | null) => {
    setNewQuestFailure(null);
    client
      .request({ _tag: "StartEmptyQuest", realmId, requestId: newRequestId() })
      .then((started) => {
        const unfold = (current: ReadonlySet<string>) => new Set([...current].filter((id) => id !== groupId));
        closedRealms.setSet(unfold);
        foldedSections.setSet(unfold);
        onOpenMission(started.missionId);
      })
      .catch((reason) => setNewQuestFailure({ groupId, message: messageOf(reason) }));
  };
  const failureUnder = (groupId: string) =>
    newQuestFailure?.groupId === groupId && <Text style={local.newQuestFailure}>{newQuestFailure.message}</Text>;

  // A quest dropped on another place waits here for the owner's confirmation; nothing moves before it.
  const [pendingMove, setPendingMove] = useState<{
    confirmation: MoveConfirmation;
    destination: Destination;
    missionId: MissionId;
  } | null>(null);
  const dropOn = (destination: Destination) => (missionId: string) => {
    const mission = data?.missions.find((each) => each.id === missionId);
    const confirmation = mission === undefined ? null : moveConfirmationOf(mission, destination);
    if (mission !== undefined && confirmation !== null)
      setPendingMove({ confirmation, destination, missionId: mission.id });
  };

  /**
   * A realm: its name with the folder mark when it is tied to a folder, its quests beneath it while it is
   * unfolded, and the button for a new quest.
   */
  const realmRow = (realm: {
    id: WorkspaceId;
    name: string;
    path: string | null;
    quests: ReadonlyArray<MissionSummary>;
    visibleQuests: ReadonlyArray<MissionSummary>;
  }) => {
    const isClosed = closedRealms.set.has(realm.id);
    return (
      <DropTarget key={realm.id} onDropQuest={dropOn({ id: realm.id, name: realm.name })}>
        <View>
          <RealmHeader
            isOpen={!isClosed}
            name={realmLabelOf(realm, data?.workspaces ?? [])}
            onNewQuest={() => startQuest(realm.id, realm.id)}
            onOverview={() => onOpenRealmQuests({ id: realm.id, name: realm.name })}
            onToggle={() => closedRealms.toggle(realm.id)}
            path={realm.path}
            questCount={realm.quests.length}
          />
          {failureUnder(realm.id)}
          {!isClosed && realm.quests.length === 0 && <Text style={local.emptyRealm}>No quest in this realm yet.</Text>}
          {!isClosed &&
            realm.visibleQuests.map((mission) => (
              <Quest {...questProps} isOpen={outline.isQuestOpen(mission.id)} key={mission.id} mission={mission} />
            ))}
          {!isClosed && realm.quests.length > realmShown && (
            <ShowAll
              count={realm.quests.length}
              onPress={() => onOpenRealmQuests({ id: realm.id, name: realm.name })}
              subject={realm.name}
            />
          )}
        </View>
      </DropTarget>
    );
  };

  const { tied, untied } = realmGroupsOf(outline.realms);
  const rowOf = ({ quests, workspace, visibleQuests }: (typeof outline.realms)[number]) =>
    realmRow({ id: workspace.id, name: workspace.name, path: workspace.path, quests, visibleQuests });
  return (
    <View style={[local.sidebar, { width }]}>
      <ScrollView contentContainerStyle={local.group} style={local.flex}>
        <Pressable
          accessibilityHint="Quests sharing lore, tied to a folder or repository or to none"
          accessibilityLabel="Realms"
          accessibilityRole="button"
          onPress={() => onPlace("Realms")}
          style={(state) => [
            local.realmsTitle,
            (state.pressed || isHovered(state)) && local.rowHovered,
            isHere("Realms") && local.rowSelected,
          ]}
        >
          <Text numberOfLines={1} style={local.realmsTitleText}>
            Realms
          </Text>
        </Pressable>
        {placements.realms.length === 0 && placements.borderlands.length === 0 && (
          <Text style={local.empty}>No realm or quest yet.</Text>
        )}
        {tied.map(rowOf)}
        {untied.map(rowOf)}
        {outline.borderlands.map((mission) => (
          <Quest {...questProps} isOpen={outline.isQuestOpen(mission.id)} key={mission.id} mission={mission} />
        ))}
        {placements.borderlands.length > borderlandsShown && (
          <ShowAll
            count={placements.borderlands.length}
            onPress={() => onPlace("Realms")}
            subject="quests in no realm"
          />
        )}
        {failureUnder("none")}
        <View style={local.buttons}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsCreating(true)}
            style={(state) => [local.button, (state.pressed || isHovered(state)) && local.rowHovered]}
          >
            <Text style={local.buttonText}>Visit a realm</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => startQuest("none", null)}
            style={(state) => [local.button, (state.pressed || isHovered(state)) && local.rowHovered]}
          >
            <Text style={local.buttonText}>Start a quest</Text>
          </Pressable>
        </View>
      </ScrollView>
      <View style={local.footer}>
        <Spending client={client} />
        <View style={local.menuRow}>
          <ActionMenu
            accessibilityLabel="Menu"
            actions={menuPlaces.map((entry) => ({ label: entry.label, onPress: () => onPlace(entry.place) }))}
            glyph="☰"
          />
        </View>
      </View>
      {pendingMove !== null && (
        <MoveQuestModal
          confirmation={pendingMove.confirmation}
          onCancel={() => setPendingMove(null)}
          onConfirm={() =>
            client.request({ _tag: "MoveQuest", missionId: pendingMove.missionId, realmId: pendingMove.destination.id })
          }
        />
      )}
      {isCreating && (
        <NewRealmModal
          client={client}
          initial={{ name: "", path: "" }}
          isFolderRequired={false}
          onCancel={() => setIsCreating(false)}
        />
      )}
    </View>
  );
}

/** The compact usage summary above the menu: the global budget's meters, when it has limits, and the plans' limits. */
function Spending({ client }: { client: ServiceClient }) {
  const { data: global } = useServiceQuery(client, { _tag: "ReadBudget", missionId: null }, "budget:global");
  if (global === null) return null;
  const hasLimits = global.limits.cost !== null || global.limits.tokens !== null;
  return (
    <View style={local.spending}>
      {hasLimits && <ReserveRows use={global} />}
      <PlanLimitRings client={client} />
    </View>
  );
}

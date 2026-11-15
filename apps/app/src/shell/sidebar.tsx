import type { Crest, MissionId, MissionSummary, ThreadId, WorkspaceId } from "@outlore/contracts";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { ReserveRows } from "../editors/budgets";
import { PlanLimitRings } from "../editors/planLimitRings";
import { messageOf, newRequestId, type ServiceClient } from "../foundation/client";
import { allMissions } from "../foundation/queries";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { NewRealmModal } from "../realms/newRealmModal";
import { realmLabelOf } from "../realms/realmLabels";
import { MoveQuestModal } from "./moveQuestModal";
import { type Place, placeGroups } from "./placeCatalog";
import { DropTarget } from "./questDrag";
import { borderlandsDestination, type Destination, type MoveConfirmation, moveConfirmationOf } from "./questMove";
import { placementsOf, type RealmListing, realmGroupsOf, toggledFold } from "./questTree";
import { railOutlineOf } from "./railOutline";
import { Quest, RealmHeader } from "./railQuests";
import { Count, Divider, Heading, Row, ShowAll } from "./railRows";
import { borderlandsShown, chevronWidth, local, realmIndent, realmShown } from "./railStyles";

export type { Place } from "./placeCatalog";

const keepRooms = placeGroups[2] ?? [];

/** A set of ids the owner toggles, as the expanded and collapsed rows of the tree. */
const useToggles = () => {
  const [set, setSet] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => setSet((current) => toggledFold(current, id));
  return { set, setSet, toggle };
};

/**
 * The left sidebar, in the agreed order: Guild Hall, the Realms with their quests, the Borderlands' quests, Rituals,
 * Craft, The Keep, Reserves, and the Workshop (the settings). Quests nest their side-quests at every depth,
 * and the sidebar opens the path to the thread that is open.
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
  /** The open rail's width, as dragged. */
  width: number;
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
   * A realm: its crest, its name with the folder mark when it is tied to a folder, its quests beneath it while it is
   * unfolded, and the button for a new quest.
   */
  const realmRow = (realm: {
    crest: Crest | null;
    id: WorkspaceId;
    name: string;
    path: string | null;
    quests: ReadonlyArray<MissionSummary>;
    visibleQuests: ReadonlyArray<MissionSummary>;
  }) => {
    const isClosed = closedRealms.set.has(realm.id);
    return (
      <DropTarget key={realm.id} onDropQuest={dropOn({ id: realm.id, name: realm.name })}>
        <View style={{ paddingLeft: realmIndent }}>
          <RealmHeader
            crest={realm.crest}
            id={realm.id}
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

  return (
    <View style={[local.sidebar, { width }]}>
      <ScrollView contentContainerStyle={local.group} style={local.flex}>
        <PlaceRow isSelected={isHere("Guildmaster")} onPress={() => onPlace("Guildmaster")} place="Guildmaster" />
        <Divider />

        <Heading
          icon="realms"
          isOpen={!foldedSections.set.has("Realms")}
          isSelected={isHere("Realms")}
          label="Realms"
          note="Quests sharing lore, tied to a folder or repository or to none"
          onAdd={() => setIsCreating(true)}
          onOverview={() => onPlace("Realms")}
          onPress={() => foldedSections.toggle("Realms")}
          onToggle={() => foldedSections.toggle("Realms")}
        />
        {!foldedSections.set.has("Realms") && placements.realms.length === 0 && (
          <Text style={local.empty}>No realm yet.</Text>
        )}
        {!foldedSections.set.has("Realms") &&
          (() => {
            // Realms tied to a folder first, then a thin line, then those tied to none (CHG-0170).
            const { tied, untied } = realmGroupsOf(outline.realms);
            const rowOf = ({ quests, workspace, visibleQuests }: (typeof outline.realms)[number]) =>
              realmRow({
                crest: workspace.crest,
                id: workspace.id,
                name: workspace.name,
                path: workspace.path,
                quests,
                visibleQuests,
              });
            return (
              <>
                {tied.map(rowOf)}
                {tied.length > 0 && untied.length > 0 && <View style={local.realmSplit} />}
                {untied.map(rowOf)}
              </>
            );
          })()}

        <DropTarget onDropQuest={dropOn(borderlandsDestination)}>
          <Heading
            icon="borderlands"
            isOpen={!foldedSections.set.has("Borderlands")}
            isSelected={isHere("Borderlands")}
            label="Borderlands"
            note="Autonomous quests, with no workspace and no shared lore"
            onNewQuest={() => startQuest("Borderlands", null)}
            onOverview={() => onPlace("Borderlands")}
            onPress={() => foldedSections.toggle("Borderlands")}
            onToggle={() => foldedSections.toggle("Borderlands")}
          />
          {failureUnder("Borderlands")}
          {!foldedSections.set.has("Borderlands") && placements.borderlands.length === 0 && (
            <Text style={local.empty}>No quest yet.</Text>
          )}
          {!foldedSections.set.has("Borderlands") &&
            outline.borderlands.map((mission) => (
              <Quest {...questProps} isOpen={outline.isQuestOpen(mission.id)} key={mission.id} mission={mission} />
            ))}
          {!foldedSections.set.has("Borderlands") && placements.borderlands.length > borderlandsShown && (
            <ShowAll
              count={placements.borderlands.length}
              onPress={() => onPlace("Borderlands")}
              subject="the Borderlands"
            />
          )}
        </DropTarget>

        <Divider />
        <PlaceRow isSelected={isHere("Rituals")} onPress={() => onPlace("Rituals")} place="Rituals" />
        <PlaceRow isSelected={isHere("Craft")} onPress={() => onPlace("Craft")} place="Craft" />
        <Divider />
        <Heading
          icon="the-keep"
          isOpen={!foldedSections.set.has("Keep")}
          label="The Keep"
          note="Library, lore, and the archive"
          onPress={() => foldedSections.toggle("Keep")}
          onToggle={() => foldedSections.toggle("Keep")}
        />
        {!foldedSections.set.has("Keep") &&
          keepRooms.map((room) => (
            <Row
              hoverAccessory={
                room.place === "Archived" ? (isShown) => <ArchiveCount client={client} isShown={isShown} /> : undefined
              }
              icon={room.icon}
              indent={chevronWidth}
              isSelected={isHere(room.place)}
              key={room.place}
              label={room.label}
              onPress={() => onPlace(room.place)}
            />
          ))}
      </ScrollView>
      <View style={local.footer}>
        <Divider />
        <PlaceRow isSelected={isHere("Reserves")} onPress={() => onPlace("Reserves")} place="Reserves" />
        <Spending client={client} />
        <Divider />
        <PlaceRow isSelected={isHere("Charter")} onPress={() => onPlace("Charter")} place="Charter" />
        <PlaceRow isSelected={isHere("Settings")} onPress={() => onPlace("Settings")} place="Settings" />
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
          initial={{ crest: null, name: "", path: "" }}
          isFolderRequired={false}
          onCancel={() => setIsCreating(false)}
        />
      )}
    </View>
  );
}

/** The number of archived quests, at the end of the Archive row, shown with the row's marks. */
function ArchiveCount({ client, isShown }: { client: ServiceClient; isShown: boolean }) {
  const request = { _tag: "ListMissions", isArchived: true, search: null, state: null, workspaceId: null } as const;
  const { data } = useServiceQuery(client, request, `missions:${JSON.stringify(request)}`);
  return <Count isShown={isShown} value={data?.missions.length ?? 0} />;
}

/** The compact usage summary under Reserves: the global budget's meters, when it has limits, and the plans' limits. */
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

/** One fixed rail destination, named and illustrated by the same catalog as the narrow menu. */
function PlaceRow({ place, isSelected, onPress }: { place: Place; isSelected: boolean; onPress: () => void }) {
  const entry = placeGroups.flat().find((entry) => entry.place === place);
  return entry === undefined ? null : (
    <Row icon={entry.icon} isMain isSelected={isSelected} label={entry.label} onPress={onPress} />
  );
}

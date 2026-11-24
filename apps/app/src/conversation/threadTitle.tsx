import type { MissionDetail, MissionId, MissionState, ThreadId, ThreadState } from "@outlore/contracts";
import { Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { listedMissions } from "../foundation/queries";
import { styles } from "../foundation/styles";
import { colors, stateLabels, stateTones } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { inRealmOf } from "../shell/realmRoster";
import { ChipIcon } from "../ui/chips";
import { Menu } from "../ui/pickers";

function TitleMenu<Id extends string>({
  kind,
  current,
  choices,
  onSelect,
}: {
  kind: "quest" | "ritual" | "errand";
  current: { id: Id; title: string; state?: ThreadState | MissionState };
  choices: ReadonlyArray<{ id: Id; title: string; state?: ThreadState | MissionState }>;
  onSelect: (id: Id) => void;
}) {
  const titles = new Map(choices.map((choice) => [choice.id, choice.title]));
  const currentTitle = current.title;
  titles.set(current.id, currentTitle);
  const states = new Map(choices.map((choice) => [choice.id, choice.state]));
  if (current.state !== undefined) states.set(current.id, current.state);
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 6, minWidth: 0 }}>
      <View
        accessibilityLabel={current.state === undefined ? kind : `${kind}, ${stateLabels[current.state]}`}
        accessible
      >
        <ChipIcon
          color={current.state === undefined ? colors.textMuted : stateTones[current.state].color}
          kind={kind}
          size={22}
        />
      </View>
      {titles.size === 1 ? (
        <Text numberOfLines={1} style={[styles.paneTitle, { flexShrink: 1 }]}>
          {currentTitle}
        </Text>
      ) : (
        <Menu
          accessibilityLabel={`${currentTitle}, switch ${kind}`}
          isTitle
          label={(id) => titles.get(id) ?? currentTitle}
          onChange={(id) => {
            if (id !== current.id) onSelect(id);
          }}
          options={Array.from(titles.keys())}
          state={(id) => states.get(id)}
          value={current.id}
        />
      )}
    </View>
  );
}

function QuestTitle({
  client,
  detail,
  onOpenMission,
}: {
  client: ServiceClient;
  detail: MissionDetail;
  onOpenMission: (id: MissionId) => void;
}) {
  const { data } = useServiceQuery(client, listedMissions.request, listedMissions.key);
  const isRitual = detail.mission.ritual !== null;
  const current = {
    id: detail.mission.id,
    state: data?.missions.find((mission) => mission.id === detail.mission.id)?.state ?? detail.thread.state,
    title: detail.thread.title,
  };
  return (
    <TitleMenu
      choices={inRealmOf(data?.missions ?? [], detail.mission.workspaceId, isRitual ? "Ritual" : "Quest")}
      current={current}
      kind={isRitual ? "ritual" : "quest"}
      onSelect={onOpenMission}
    />
  );
}

export function ThreadTitle({
  client,
  detail,
  onOpenMission,
  onSelect,
}: {
  client: ServiceClient;
  detail: MissionDetail;
  onOpenMission: (id: MissionId) => void;
  onSelect: (id: ThreadId) => void;
}) {
  if (detail.thread.parentId === null) {
    return <QuestTitle client={client} detail={detail} onOpenMission={onOpenMission} />;
  }
  return (
    <TitleMenu
      choices={detail.threads
        .filter((thread) => thread.parentId !== null && thread.isArchived !== true)
        .map((thread) => ({ ...thread, state: thread.shownState }))}
      current={{
        ...detail.thread,
        state: detail.threads.find((thread) => thread.id === detail.thread.id)?.shownState ?? detail.thread.state,
      }}
      kind="errand"
      onSelect={onSelect}
    />
  );
}

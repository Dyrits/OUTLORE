import type { MissionDetail, MissionId, ThreadId } from "@outlore/contracts";
import { Text } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { nameWithId } from "../foundation/displayId";
import { allMissions } from "../foundation/queries";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Menu } from "../ui/pickers";

function TitleMenu<Id extends string>({
  kind,
  current,
  choices,
  onSelect,
}: {
  kind: "quest" | "errand";
  current: { id: Id; title: string };
  choices: ReadonlyArray<{ id: Id; title: string }>;
  onSelect: (id: Id) => void;
}) {
  const titles = new Map(choices.map((choice) => [choice.id, nameWithId(kind, choice.id, choice.title)]));
  const currentTitle = nameWithId(kind, current.id, current.title);
  titles.set(current.id, currentTitle);
  return titles.size === 1 ? (
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
      value={current.id}
    />
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
  const { data } = useServiceQuery(client, allMissions.request, allMissions.key);
  const current = { id: detail.mission.id, title: detail.thread.title };
  return <TitleMenu choices={data?.missions ?? []} current={current} kind="quest" onSelect={onOpenMission} />;
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
      choices={detail.threads.filter((thread) => thread.parentId !== null)}
      current={detail.thread}
      kind="errand"
      onSelect={onSelect}
    />
  );
}

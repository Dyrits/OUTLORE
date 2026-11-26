import type { MissionDetail, MissionId, ThreadId } from "@outlore/contracts";
import { memo, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { listedMissions } from "../foundation/queries";
import { inRealmOf } from "../foundation/realmFilter";
import { styles } from "../foundation/styles";
import { colors, stateLabels, stateTones } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { ChipIcon } from "../ui/chips";
import { Menu } from "../ui/pickers";
import { sameTitleChoices, type TitleChoice } from "./titleChoices";

function TitleMenu<Id extends string>({
  kind,
  current,
  choices,
  onSelect,
  onShowParent,
}: {
  kind: "quest" | "ritual" | "errand";
  current: TitleChoice<Id>;
  choices: ReadonlyArray<TitleChoice<Id>>;
  onSelect: (id: Id) => void;
  /** Set for a quest or an errand: the title then leads to its parent's tab, instead of opening the menu. */
  onShowParent?: () => void;
}) {
  const titles = new Map(choices.map((choice) => [choice.id, choice.title]));
  const currentTitle = current.title;
  titles.set(current.id, currentTitle);
  const states = new Map(choices.map((choice) => [choice.id, choice.state]));
  if (current.state !== undefined) states.set(current.id, current.state);
  const parentTab = kind === "errand" ? "Errands" : "Quests";
  return (
    // The icon's box and the gap after it match the channel pane's header, so the titles line up across panes.
    <View style={{ alignItems: "center", flexDirection: "row", gap: 12, minWidth: 0 }}>
      <View
        accessibilityLabel={current.state === undefined ? kind : `${kind}, ${stateLabels[current.state]}`}
        accessible
        style={{ alignItems: "center", height: 26, justifyContent: "center", width: 26 }}
      >
        <ChipIcon
          color={current.state === undefined ? colors.textMuted : stateTones[current.state].color}
          kind={kind}
          size={22}
        />
      </View>
      {onShowParent !== undefined ? (
        <Pressable
          accessibilityLabel={`${currentTitle}, show ${parentTab}`}
          accessibilityRole="button"
          onPress={onShowParent}
          style={{ flexShrink: 1, minWidth: 0 }}
        >
          <Text numberOfLines={1} style={styles.paneTitle}>
            {currentTitle}
          </Text>
        </Pressable>
      ) : titles.size === 1 ? (
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

/** The quest's menu, memoized so it renders again only when its own choices, state or callback change. */
const QuestTitleMenu = memo(function QuestTitleMenu(props: {
  choices: ReadonlyArray<TitleChoice<MissionId>>;
  current: TitleChoice<MissionId>;
  kind: "quest" | "ritual";
  onSelect: (id: MissionId) => void;
  onShowParent?: () => void;
}) {
  return <TitleMenu {...props} />;
});

/** Keeps the previous list while a new one draws the same menu, so the memoized menu below it does not render again. */
function useStableChoices<Id extends string>(choices: ReadonlyArray<TitleChoice<Id>>) {
  const kept = useRef(choices);
  if (!sameTitleChoices(kept.current, choices)) kept.current = choices;
  return kept.current;
}

/**
 * The quest's title with a menu of the realm's quests.
 * The shared missions query changes whenever any quest does, so this re-renders then; the menu below renders again only when its own choices or state differ.
 */
function QuestTitle({
  client,
  detail,
  onOpenMission,
  onShowParent,
}: {
  client: ServiceClient;
  detail: MissionDetail;
  onOpenMission: (id: MissionId) => void;
  onShowParent?: () => void;
}) {
  const { data } = useServiceQuery(client, listedMissions.request, listedMissions.key);
  const isRitual = detail.mission.ritual !== null;
  const id = detail.mission.id;
  const state = data?.missions.find((mission) => mission.id === id)?.state ?? detail.thread.state;
  const title = detail.thread.title;
  const current = useMemo(() => ({ id, state, title }), [id, state, title]);
  const choices = useStableChoices(
    inRealmOf(data?.missions ?? [], detail.mission.workspaceId, isRitual ? "Ritual" : "Quest").map((mission) => ({
      id: mission.id,
      state: mission.state,
      title: mission.title,
    })),
  );
  return (
    <QuestTitleMenu
      choices={choices}
      current={current}
      kind={isRitual ? "ritual" : "quest"}
      onSelect={onOpenMission}
      // A Ritual's parent tab is its Rituals, not the Quests list, so its title keeps the menu.
      {...(onShowParent === undefined || isRitual ? {} : { onShowParent })}
    />
  );
}

/**
 * The thread's title. In a pane, `onShowParent` shows the parent's tab instead of a menu: a quest's Quests tab of its
 * realm, an errand's Errands tab of its quest. Without it, a quest or an errand keeps the menu of its siblings.
 */
export function ThreadTitle({
  client,
  detail,
  onOpenMission,
  onSelect,
  onShowParent,
}: {
  client: ServiceClient;
  detail: MissionDetail;
  onOpenMission: (id: MissionId) => void;
  onSelect: (id: ThreadId) => void;
  onShowParent?: () => void;
}) {
  if (detail.thread.parentId === null) {
    return (
      <QuestTitle
        client={client}
        detail={detail}
        onOpenMission={onOpenMission}
        {...(onShowParent === undefined ? {} : { onShowParent })}
      />
    );
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
      {...(onShowParent === undefined ? {} : { onShowParent })}
    />
  );
}

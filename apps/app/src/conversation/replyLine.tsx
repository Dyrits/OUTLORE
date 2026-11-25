import type { MissionId, MissionSummary, ThreadId, ThreadSummary } from "@outlore/contracts";
import { createContext, type ReactNode, useContext } from "react";
import type { ServiceClient } from "../foundation/client";
import { agoOf } from "../foundation/formatting";
import { allMissions } from "../foundation/queries";
import { stateLabels } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { scheduleLabelOf } from "../rituals/ritualLabels";
import { CompactReplyBar } from "./compactReplyBar";
import { ReplyCard } from "./replyCard";

// The cards and lines of the quests and errands a conversation hangs from messages (conversation panes). The shell
// imports them from here, so the creation card is passed on from its own file.
export { NewReplyCard } from "./replyCard";

/** The threads open as panes beside the one drawing, so a reply line can show that its errand is already open. */
export const OpenPanes = createContext<ReadonlySet<ThreadId>>(new Set());

/**
 * The reply line under the message an errand hangs from (CHG-0561): who opened it, its title, a sample of its last
 * exchange, its state and how long ago it last moved. Pressing it opens the errand's conversation in the next pane, as a
 * thread opens in Slack; it is marked while that pane is open.
 */
export function ReplyLine({
  actions,
  isCompact = false,
  onOpen,
  thread,
}: {
  actions?: ReactNode;
  isCompact?: boolean;
  onOpen: (threadId: ThreadId) => void;
  thread: ThreadSummary;
}) {
  const isOpen = useContext(OpenPanes).has(thread.id);
  if (isCompact && actions === undefined) {
    return (
      <CompactReplyBar
        activityAt={thread.lastActivityAt}
        isOpen={isOpen}
        kind="errand"
        label={`Errand: ${thread.title}, ${stateLabels[thread.shownState]}`}
        onPress={() => onOpen(thread.id)}
        replyCount={thread.replyCount}
        state={thread.shownState}
        title={thread.title}
        waitingCount={thread.waitingCount}
      />
    );
  }
  return (
    <ReplyCard
      actions={actions}
      isOpen={isOpen}
      label={`Errand: ${thread.title}, ${stateLabels[thread.shownState]}`}
      meta={`${thread.waitingCount > 0 ? ` · ${thread.waitingCount} waiting` : ""} · ${agoOf(thread.lastActivityAt, Date.now())}`}
      onPress={() => onOpen(thread.id)}
      origin={thread.isOpenedByAgent ? "Companion opened an errand" : "Opened an errand"}
      sample={thread.lastExchange}
      state={thread.shownState}
      title={thread.title}
    />
  );
}

/**
 * A quest as a block (conversation panes): what Chronicler or the owner made of it, its state, a sample of its last
 * exchange and how long ago it last moved. Pressing it opens the quest in the next pane; it is marked while that pane is
 * open. The reply line in a realm's conversation and the realm's Quests tab both show quests this way.
 */
export function QuestCard({
  actions,
  label,
  onOpen,
  origin,
  quest,
}: {
  actions?: ReactNode;
  label: string;
  onOpen: () => void;
  origin: string;
  quest: MissionSummary;
}) {
  const isOpen = useContext(OpenPanes).has(quest.topThreadId);
  return (
    <ReplyCard
      actions={actions}
      isOpen={isOpen}
      label={`${label}: ${quest.title}`}
      meta={`${quest.state === "Resting" ? " · your turn" : ""} · ${agoOf(quest.lastActivityAt, Date.now())}`}
      onPress={onOpen}
      origin={origin}
      sample={quest.lastExchange}
      state={quest.state}
      title={quest.title}
    />
  );
}

/**
 * A Ritual as a block, as the realm's Quests tab lists it beside the quests (CHG-0616): the moon's meaning carried by
 * its label, its schedule in place of a quest's last exchange, and its runs openable as errands once pressed.
 */
export function RitualReplyCard({ onOpen, ritual }: { onOpen: () => void; ritual: MissionSummary }) {
  const card = ritual.ritual;
  const isOpen = useContext(OpenPanes).has(ritual.topThreadId);
  if (card === null) return null;
  return (
    <ReplyCard
      isOpen={isOpen}
      isRitual
      label={`Ritual: ${ritual.title}`}
      meta={` · ${[
        scheduleLabelOf(card.schedule),
        card.isOn ? "On" : "Off",
        ...(card.lastRunState === "Underway" ? ["A run is underway"] : []),
      ].join(" · ")}`}
      onPress={onOpen}
      origin="Ritual"
      sample={null}
      state={ritual.state}
      title={ritual.title}
    />
  );
}

/**
 * The reply line of a quest in the Chronicle (CHG-0564): the quest Chronicler opened or continued stands as a card under
 * the message that confirmed it, with the quest's own state and how long ago it last moved, read from the quest list so
 * it stays current. Pressing it opens the quest in the next pane. A quest the list no longer holds (archived, or not yet
 * loaded) keeps the title and the state it was opened with.
 */
export function QuestReplyLine({
  client,
  isCompact = false,
  label,
  missionId,
  onOpen,
  title,
}: {
  client: ServiceClient;
  isCompact?: boolean;
  /** What Chronicler did with the quest: "Opened a quest", "Continued in a quest". */
  label: string;
  missionId: MissionId;
  onOpen: (missionId: MissionId) => void;
  title: string;
}) {
  const { data } = useServiceQuery(client, allMissions.request, allMissions.key);
  const quest = data?.missions.find((mission) => mission.id === missionId) ?? null;
  const openPanes = useContext(OpenPanes);
  if (isCompact) {
    return (
      <CompactReplyBar
        activityAt={quest?.lastActivityAt ?? null}
        isOpen={quest !== null && openPanes.has(quest.topThreadId)}
        kind="quest"
        label={`${label}: ${quest?.title ?? title}`}
        onPress={() => onOpen(missionId)}
        replyCount={quest?.replyCount}
        state={quest?.state}
        title={quest?.title ?? title}
      />
    );
  }
  if (quest !== null) return <QuestCard label={label} onOpen={() => onOpen(missionId)} origin={label} quest={quest} />;
  return (
    <ReplyCard
      isOpen={false}
      label={`${label}: ${title}`}
      meta=""
      onPress={() => onOpen(missionId)}
      origin={label}
      sample={null}
      title={title}
    />
  );
}

import type { MissionDetail, MissionId, ThreadId } from "@outlore/contracts";
import { type ReactNode, useContext } from "react";
import { Pressable, Text, View } from "react-native";
import { newRequestId, type ServiceClient } from "../foundation/client";
import { QuestTabButtonContext } from "../foundation/shellContext";
import { styles } from "../foundation/styles";
import type { useEnding } from "../foundation/useEnding";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { RunNowButton } from "../rituals/ritualCard";
import { ArchiveButton } from "../ui/archiveButton";
import {
  DoneButton,
  HeaderSeparator,
  NewErrandButton,
  NewQuestButton,
  QuestPanelButton,
} from "../ui/questHeaderButtons";
import { ErrandHeaderActions, hasErrandActions } from "./errandHeaderActions";
import { MobileHeader, mobileIconTarget } from "./mobileHeader";
import { ThreadTitle } from "./threadTitle";

function RitualRunAction({
  client,
  missionId,
  onError,
}: {
  client: ServiceClient;
  missionId: MissionId;
  onError: (message: string | null) => void;
}) {
  const { data: ritual, error } = useServiceQuery(client, { _tag: "ReadRitual", missionId }, `ritual:${missionId}`);
  if (error !== null) return <Text style={styles.error}>{error}</Text>;
  if (ritual === null) return null;
  return (
    <RunNowButton
      client={client}
      isBlocked={ritual.isRealmArchived}
      isInHeader
      isUnderway={ritual.lastRunState === "Underway"}
      onError={onError}
      ritualId={ritual.id}
    />
  );
}

/** Mobile and desktop header bar for a thread pane, with quest, errand, and Ritual actions. */
export function ThreadPaneHeader({
  act,
  canOpenDetails,
  chrome,
  client,
  detail,
  ending,
  isInPane,
  onBack,
  onNewErrand,
  onOpenDetails,
  onOpenMission,
  onRitualRunError,
  onSelect,
  canTakeTurns,
}: {
  act: (promise: Promise<unknown>) => Promise<void>;
  canOpenDetails: boolean;
  chrome?: ReactNode;
  client: ServiceClient;
  detail: MissionDetail;
  ending: ReturnType<typeof useEnding>;
  isInPane: boolean;
  onBack?: () => void;
  onNewErrand?: () => void;
  onOpenDetails: () => void;
  onOpenMission: (missionId: MissionId) => void;
  onRitualRunError: (message: string | null) => void;
  onSelect: (threadId: ThreadId) => void;
  canTakeTurns: boolean;
}) {
  const { thread } = detail;
  const { canResume } = thread.actions;
  const ritualRunAction = canTakeTurns ? null : (
    <RitualRunAction client={client} missionId={detail.mission.id} onError={onRitualRunError} />
  );
  // Only a quest's own thread archives it, and not a Ritual or one already archived.
  const isOwnQuest = thread.parentId === null && detail.mission.ritual === null && detail.mission.state !== "Archived";
  const archiveAction = isOwnQuest && (
    <ArchiveButton
      isDelete={detail.mission.isEmpty}
      isDisabled={ending.isBusy}
      label={detail.mission.isEmpty ? "Delete quest" : "Archive quest"}
      onPress={() => ending.start("Archived")}
      style={onBack === undefined ? null : mobileIconTarget}
    />
  );
  // Mark as done is a checkbox: pressing it again takes the mark back (ReopenMission, as the Archive's Reopen does).
  const isDone = detail.mission.state === "Fulfilled";
  const markDone = isOwnQuest
    ? () =>
        isDone
          ? ending.run(() => client.request({ _tag: "ReopenMission", missionId: detail.mission.id }))
          : ending.start("Fulfilled")
    : null;
  const errandActions = <ErrandHeaderActions act={act} client={client} detail={detail} onSelect={onSelect} />;
  const doneAction = markDone !== null && (
    <DoneButton
      isDisabled={ending.isBusy || ending.pending !== null}
      isDone={isDone}
      onPress={markDone}
      style={onBack === undefined ? null : mobileIconTarget}
    />
  );
  const hasActions = isOwnQuest || hasErrandActions(detail);
  const windowQuestTab = useContext(QuestTabButtonContext);
  const questTab = isInPane ? null : windowQuestTab;
  // A separator after the last action only divides it from something that follows.
  const hasAfterActions = questTab !== null || chrome != null;
  return (
    <>
      {onBack !== undefined && (
        <MobileHeader
          actions={
            ritualRunAction ??
            (isOwnQuest ? (
              <>
                {doneAction}
                {archiveAction}
              </>
            ) : (
              errandActions
            ))
          }
          onBack={onBack}
          title={<ThreadTitle client={client} detail={detail} onOpenMission={onOpenMission} onSelect={onSelect} />}
        />
      )}
      {(onBack === undefined || canResume || canOpenDetails) && (
        <View style={styles.header}>
          {onBack === undefined && (
            <>
              <View style={styles.flex}>
                <ThreadTitle client={client} detail={detail} onOpenMission={onOpenMission} onSelect={onSelect} />
              </View>
              {canResume && (
                <Pressable onPress={() => act(client.request({ _tag: "ResumeThread", threadId: thread.id }))}>
                  <Text style={styles.link}>Resume</Text>
                </Pressable>
              )}
              {archiveAction}
              {doneAction}
              {errandActions}
              {ritualRunAction}
              {ritualRunAction !== null && chrome != null && <HeaderSeparator />}
              {isInPane && thread.parentId === null && canTakeTurns && (
                <>
                  <HeaderSeparator />
                  <NewQuestButton
                    onPress={() =>
                      void act(
                        client
                          .request({
                            _tag: "StartEmptyQuest",
                            realmId: detail.mission.workspaceId,
                            requestId: newRequestId(),
                          })
                          .then((started) => onOpenMission(started.missionId)),
                      )
                    }
                  />
                  {hasAfterActions && <HeaderSeparator />}
                </>
              )}
              {onNewErrand !== undefined && (
                <>
                  <HeaderSeparator />
                  <NewErrandButton onPress={onNewErrand} />
                  {hasAfterActions && <HeaderSeparator />}
                </>
              )}
              {onNewErrand === undefined &&
                !(isInPane && thread.parentId === null) &&
                hasActions &&
                (questTab !== null || chrome != null) && <HeaderSeparator />}
              {questTab !== null && <QuestPanelButton isOpen={questTab.isOpen} onPress={questTab.onPress} />}
              {questTab !== null && chrome != null && <HeaderSeparator />}
              {chrome}
            </>
          )}
          {onBack !== undefined && canResume && (
            <Pressable onPress={() => act(client.request({ _tag: "ResumeThread", threadId: thread.id }))}>
              <Text style={styles.link}>Resume</Text>
            </Pressable>
          )}
          {canOpenDetails && (
            <Pressable onPress={onOpenDetails}>
              <Text style={styles.link}>{canTakeTurns ? "Quest panel" : "Ritual panel"}</Text>
            </Pressable>
          )}
        </View>
      )}
    </>
  );
}

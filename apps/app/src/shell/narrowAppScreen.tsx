import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Conversation } from "../conversation/conversation";
import type { ServiceClient } from "../foundation/client";
import type { Destination, Navigation } from "./appScreen";
import { ChannelPane, type ChannelTabMemory } from "./channelPane";
import { HeaderScope } from "./headerScope";
import { PhoneErrandStarter } from "./phoneErrandStarter";
import type { Place } from "./sidebar";

/** Renders the active screen in a narrow window, keeping the channel and quest mounted beneath covering layers. */
export function NarrowAppScreen({
  channelTab,
  client,
  navigation,
  ritualForm,
  screens,
  view,
}: {
  channelTab: ChannelTabMemory;
  client: ServiceClient;
  navigation: Navigation;
  ritualForm: ReactNode;
  screens: Record<Place, ReactNode>;
  view: Destination;
}) {
  const { channel } = view;
  const conversation =
    view.openMission === null ? null : (
      <Conversation
        client={client}
        key={`${view.openMission}:${view.openCount}`}
        missionId={view.openMission}
        onBack={navigation.backFromQuest}
        onNewErrand={() => navigation.setErrandStarter(true)}
        onOpenMission={(id) => navigation.openMission(id, view.questReturn ?? void 0)}
        onSelectThread={navigation.selectThread}
        onSetDetails={navigation.showDetails}
        selectedThreadId={view.openThread}
        shouldShowErrandsInitially={view.errandsRequest !== null}
      />
    );
  const isStartingHere = view.isErrandStarterOpen && view.openMission !== null;
  const isConversationActive = view.ritualForm === null && !isStartingHere;
  const conversationLayer =
    conversation === null ? null : (
      <>
        <View style={isConversationActive ? local.fill : local.parked}>
          <HeaderScope isActive={isConversationActive}>{conversation}</HeaderScope>
        </View>
        {isStartingHere && view.openMission !== null && view.ritualForm === null && (
          <View style={local.fill}>
            <PhoneErrandStarter
              client={client}
              missionId={view.openMission}
              onClose={() => navigation.setErrandStarter(false)}
              onOpened={(threadId) => navigation.selectThread(threadId)}
            />
          </View>
        )}
      </>
    );

  if (channel !== null) {
    const isChannelShown = view.place === "Channel" && conversation === null && view.ritualForm === null;
    return (
      <>
        <View style={isChannelShown ? local.fill : local.parked}>
          <HeaderScope isActive={isChannelShown}>
            <ChannelPane
              channel={channel}
              client={client}
              listRequest={channel.questsRequest ?? void 0}
              onBack={() => navigation.goTo("Chronicle")}
              onOpenMission={(id) => navigation.openMission(id, "channel")}
              onOpenThread={(missionId, threadId) => navigation.openThread(missionId, threadId, "channel")}
              tabMemory={channelTab}
            />
          </HeaderScope>
        </View>
        {conversationLayer}
        {ritualForm ?? (conversation === null && view.place !== "Channel" && screens[view.place])}
      </>
    );
  }
  if (conversationLayer !== null) {
    // The Ritual form can cover the quest's conversation, which stays mounted beneath it (CHG-0643).
    return (
      <>
        {conversationLayer}
        {ritualForm}
      </>
    );
  }
  return view.ritualForm !== null ? ritualForm : screens[view.place];
}

const local = StyleSheet.create({
  fill: { flex: 1 },
  // Out of sight and out of the layout, but mounted: the channel and quest keep their drafts for the way back.
  parked: { display: "none" },
});

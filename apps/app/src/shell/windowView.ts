import type { Location } from "./location";

/** Whether the current destination owns the conversation area of the wide window. */
export const hasConversationPanes = ({ openMission, place }: Pick<Location, "openMission" | "place">): boolean =>
  place === "Channel" || openMission !== null;

/** A realm channel or the Borderlands when no realm is selected. */
export const channelOf = (id: string | null | undefined, name: string | null | undefined) => ({
  id: id ?? null,
  name: name ?? "Borderlands",
});

/** Which conversations the page shows or keeps mounted behind the Workshop. */
export const windowViewOf = (location: Location) => {
  const workshopReturn =
    location.place === "Settings" && location.openMission === null ? location.workshopReturn : null;
  const channel = location.place === "Channel" ? location : workshopReturn?.place === "Channel" ? workshopReturn : null;
  return {
    channel:
      channel === null
        ? null
        : {
            ...channelOf(channel.listedRealm?.id, channel.listedRealm?.name),
            questsRequest: channel.listRequest?.tab === "quests" ? channel.listRequest : null,
          },
    errandsRequest: location.listRequest?.tab === "errands" ? location.listRequest : null,
    isPermissionsOpen: location.isPermissionsOpen,
    listedRealm: location.listedRealm,
    openCount: location.openCount,
    openMission: location.openMission,
    openThread: location.openThread,
    parkedQuest:
      workshopReturn?.openMission == null
        ? null
        : {
            errandsRequest: workshopReturn.listRequest?.tab === "errands" ? workshopReturn.listRequest : null,
            openCount: workshopReturn.openCount,
            openMission: workshopReturn.openMission,
            openThread: workshopReturn.openThread,
          },
    place: location.place,
    questReturn: location.questReturn,
    // The Ritual form covering the conversation area (CHG-0643), kept apart from the panes it opens over.
    ritualForm: location.ritualForm,
    selectedMission: location.selectedMission,
    settingsSection: location.settingsSection,
  };
};

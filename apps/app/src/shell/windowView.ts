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
    channel: channel === null ? null : channelOf(channel.listedRealm?.id, channel.listedRealm?.name),
    isPermissionsOpen: location.isPermissionsOpen,
    listedRealm: location.listedRealm,
    openCount: location.openCount,
    openMission: location.openMission,
    openThread: location.openThread,
    parkedQuest:
      workshopReturn?.openMission == null
        ? null
        : {
            openCount: workshopReturn.openCount,
            openMission: workshopReturn.openMission,
            openThread: workshopReturn.openThread,
          },
    place: location.place,
    selectedMission: location.selectedMission,
    settingsSection: location.settingsSection,
  };
};

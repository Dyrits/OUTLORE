export { resumablePlaces } from "./placeCatalog";

/** Returns to the archived quest's actual parent, not the screen it happened to be opened from. */
export const archiveParentOf = <Id extends string>(quest: { workspaceId: Id | null; workspaceName: string | null }) =>
  quest.workspaceId === null
    ? { listing: null, place: "Home" as const }
    : { listing: { id: quest.workspaceId, name: quest.workspaceName ?? "Realm" }, place: "Channel" as const };

/** Whether the screen offers details the owner can explicitly open. */
export type DetailsMode = "none" | "toggle";

/** Offers details for an open or selected quest; no destination opens them automatically. */
export const detailsModeOf = (view: { openMission: string | null; selectedMission: string | null }): DetailsMode =>
  view.openMission !== null || view.selectedMission !== null ? "toggle" : "none";

import type { ReactNode } from "react";

// Dragging a quest onto a realm or the Borderlands. Only the web build (the desktop window and the phone's browser) can
// drag; other builds draw the children as they are.

/** What a dragged quest carries: its mission id, under this type. */
export const questDragType = "application/x-outlore-quest";

/** A quest row that can be picked up. */
export interface DragSourceProps {
  readonly children: ReactNode;
  /** The quest's mission id. */
  readonly missionId: string;
}

/** What a dragged realm carries: its workspace id, under this type. */
export const realmDragType = "application/x-outlore-realm";

/** A realm's heading, which can be picked up to put the realm in another place of the list. */
export interface RealmDragSourceProps {
  readonly children: ReactNode;
  /** The realm's workspace id. */
  readonly realmId: string;
}

/** A place a quest can be dropped on, and where a dragged realm can be put. */
export interface DropTargetProps {
  readonly children: ReactNode;
  /** Hears the mission id of the quest dropped here. */
  readonly onDropQuest: (missionId: string) => void;
  /**
   * Hears the workspace id of the realm dropped here, when the place is a realm, and whether it was dropped on the
   * place's upper or lower half: the dragged realm goes before or after this one.
   */
  readonly onDropRealm?: (realmId: string, side: "before" | "after") => void;
}

/** Whether a drag in progress carries a quest, read from the types its data transfer lists. */
export const dragCarriesQuest = (types: ReadonlyArray<string>): boolean => types.includes(questDragType);

/** Whether a drag in progress carries a realm, read from the types its data transfer lists. */
export const dragCarriesRealm = (types: ReadonlyArray<string>): boolean => types.includes(realmDragType);

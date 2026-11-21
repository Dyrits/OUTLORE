import type { MissionSummary, RitualCard, ThreadSummary, WorkspaceChoice } from "@outlore/contracts";

/**
 * How a Ritual reads as a row among the quests of its realm (CHG-0616): the moon, its schedule, a dot while a run is
 * underway, dimmed while off — and the realm-archived notice for a Ritual whose realm is archived. The service sends
 * the Ritual's fields on its own mission record; these helpers are how every list draws them the same way.
 */

/** Whether a run of the Ritual is underway, from the run state its mission record carries. */
export const runIsUnderwayOf = (ritual: RitualCard | null): boolean => ritual?.lastRunState === "Underway";

/**
 * Whether a mission's realm is archived: the active views hold every active realm, even one with nothing in it, so a
 * realm missing from them is archived. A Ritual of an archived realm keeps that realm as its place, and its row keeps
 * the notice.
 */
export const isRealmArchivedOf = (
  mission: Pick<MissionSummary, "workspaceId">,
  realms: ReadonlyArray<Pick<WorkspaceChoice, "id">>,
): boolean => mission.workspaceId !== null && realms.every((realm) => realm.id !== mission.workspaceId);

/** The one confirmation a Ritual's Delete asks: it names what is lost — the Ritual, its runs' errands, and their history. */
export const deleteRitualQuestion = (title: string): string => `Delete "${title}"?`;

/** What the confirmation says is lost, and that Cancel keeps it: the deletion is permanent. */
export const deleteRitualLoss =
  "The Ritual, its runs' errands, and their history are removed permanently. Cancel keeps everything.";

/** The mark of the confirming press, which deletes for good. */
export const deleteRitualConfirm = "Delete forever";

/**
 * Whether the owner writes in a conversation's box here: never in a Ritual's own thread, where no thread takes turns
 * and only its runs write (CHG-0616); an errand beneath, a run among them, keeps its composer.
 */
export const takesTurnsIn = (thread: Pick<ThreadSummary, "parentId">, ritual: RitualCard | null): boolean =>
  ritual === null || thread.parentId !== null;

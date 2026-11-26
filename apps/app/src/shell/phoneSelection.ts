import type { MissionId, ThreadId } from "@outlore/contracts";
import type { Location, NavigationEvent } from "./location";
import type { RealmListing } from "./questTree";

// What the phone's bar remembers (CHG-0773): the realm, quest and errand the owner chose. The bar shows the Quests tab
// once a realm is chosen and the Errands tab once a quest is, and each tab returns to its choice. The rules are plain
// functions, so they run in Node and the bar only draws what they say.

/** A realm as the bar names it: `id` is null for the Borderlands, whose quests belong to no realm. */
export type PhoneRealm = { readonly id: string | null; readonly name: string };

/** The realm, quest and errand the bar holds; each is null until chosen, and a quest or errand belongs to the ones before it. */
export type PhoneSelection = {
  readonly errand: ThreadId | null;
  readonly quest: MissionId | null;
  readonly realm: PhoneRealm | null;
};

/** Nothing chosen: the bar shows the Chronicle and Realms tabs only. */
export const emptySelection: PhoneSelection = { errand: null, quest: null, realm: null };

/** The name the Borderlands carry in the bar and its sheets. */
export const borderlandsName = "Borderlands";

/** The realm a channel's listing stands for: no listing is the Borderlands. */
export const realmOfListing = (listing: RealmListing | null): PhoneRealm =>
  listing === null ? { id: null, name: borderlandsName } : { id: listing.id, name: listing.name };

/** The listing a channel opens for a realm, which is null for the Borderlands. */
export const listingOfRealm = (realm: PhoneRealm): RealmListing | null =>
  realm.id === null ? null : { id: realm.id, name: realm.name };

/** The realm a quest belongs to, from the mission list, or null while the quest is not in it yet. */
export const questRealmOf = (
  mission: { workspaceId: string | null; workspaceName: string | null } | null,
): PhoneRealm | null =>
  mission === null ? null : { id: mission.workspaceId, name: mission.workspaceName ?? borderlandsName };

const isSameRealm = (first: PhoneRealm | null, second: PhoneRealm | null) =>
  first === null || second === null ? first === second : first.id === second.id && first.name === second.name;

/**
 * The selection after the screen shown: a quest or errand on show chooses itself and its realm, and a realm's channel
 * chooses the realm, keeping the quest and errand only while the realm is the same. Any other screen leaves the
 * selection as it was, so the tabs still lead back. The same value comes back when nothing changed.
 */
export const selectionOf = (
  previous: PhoneSelection,
  location: Pick<Location, "listedRealm" | "openMission" | "openThread" | "place">,
  questRealm: PhoneRealm | null,
): PhoneSelection => {
  if (location.openMission !== null) {
    const realm = questRealm ?? previous.realm;
    const errand = location.openThread ?? (previous.quest === location.openMission ? previous.errand : null);
    const isSame =
      previous.quest === location.openMission && previous.errand === errand && isSameRealm(previous.realm, realm);
    return isSame ? previous : { errand, quest: location.openMission, realm };
  }
  if (location.place !== "Channel") return previous;
  const realm = realmOfListing(location.listedRealm);
  if (isSameRealm(previous.realm, realm)) return previous;
  return { errand: null, quest: null, realm };
};

/**
 * Drops archived or deleted realms, quests and errands from the bar's memory once they are no longer on show, so the
 * tabs never point to gone items. Returns the same value when everything remembered is still valid.
 */
export const reconcileSelection = (
  selection: PhoneSelection,
  active: {
    readonly missions: ReadonlyArray<{ readonly id: MissionId }>;
    readonly workspaces: ReadonlyArray<{ readonly id: string }>;
  },
  location: Pick<Location, "openMission" | "openThread">,
  questThreads?: {
    readonly missionId: MissionId;
    readonly threads: ReadonlyArray<{
      readonly id: ThreadId;
      readonly isArchived?: boolean;
      readonly parentId: ThreadId | null;
    }>;
  } | null,
): PhoneSelection => {
  if (
    selection.realm !== null &&
    selection.realm.id !== null &&
    !active.workspaces.some((workspace) => workspace.id === selection.realm?.id)
  )
    return emptySelection;
  if (
    selection.quest !== null &&
    location.openMission !== selection.quest &&
    !active.missions.some((mission) => mission.id === selection.quest)
  )
    return { errand: null, quest: null, realm: selection.realm };
  if (
    selection.errand !== null &&
    location.openThread !== selection.errand &&
    questThreads !== null &&
    questThreads !== undefined &&
    questThreads.missionId === selection.quest &&
    !questThreads.threads.some(
      (thread) => thread.id === selection.errand && thread.parentId !== null && thread.isArchived !== true,
    )
  )
    return { errand: null, quest: selection.quest, realm: selection.realm };
  return selection;
};

/** Which of a tab's choices a sheet offers. */
export type ChoiceKind = "realm" | "quest" | "errand";

/** The tabs of the bar that choose something. */
export type ChoosingTab = "realms" | "quests" | "errands";

/** The bar's four tabs: the Chronicle, and the realm, quest and errand chosen, each landing in its chat. */
export type PhoneTab = "chronicle" | ChoosingTab;

/** What tapping a choosing tab asks of the frame: dismiss an open sheet, navigate to its choice, or open a sheet. */
export type TabTapOutcome =
  | { readonly kind: "dismiss" }
  | { readonly event: NavigationEvent; readonly kind: "navigate" }
  | { readonly choice: ChoiceKind; readonly kind: "choose" };

const kindOf: Record<ChoosingTab, ChoiceKind> = { errands: "errand", quests: "quest", realms: "realm" };

/**
 * What a tab does when it is held: it opens the sheet that chooses what the tab stands for. A tab whose parent is not
 * chosen yet asks for the parent first, though the bar shows no such tab.
 */
export const heldChoiceOf = (tab: ChoosingTab, selection: PhoneSelection): ChoiceKind => {
  if (tab !== "realms" && selection.realm === null) return "realm";
  if (tab === "errands" && selection.quest === null) return "quest";
  return kindOf[tab];
};

/**
 * What a tab does when it is tapped: tapping the tab already on show only puts a sheet away; otherwise it shows its
 * choice when there is one, as a navigation event, or opens the sheet that makes it.
 */
export const tappedTabOf = (
  tab: ChoosingTab,
  selection: PhoneSelection,
  activeTab: PhoneTab | null = null,
): TabTapOutcome => {
  if (activeTab === tab) return { kind: "dismiss" };
  if (tab === "realms" && selection.realm !== null)
    return { event: { listing: listingOfRealm(selection.realm), type: "channel" }, kind: "navigate" };
  if (tab === "quests" && selection.quest !== null)
    return { event: { id: null, missionId: selection.quest, type: "thread" }, kind: "navigate" };
  if (tab === "errands" && selection.quest !== null && selection.errand !== null)
    return { event: { id: selection.errand, missionId: selection.quest, type: "thread" }, kind: "navigate" };
  return { choice: heldChoiceOf(tab, selection), kind: "choose" };
};

/** Whether the Quests and Errands tabs are on the bar: each follows its parent's choice, and an open quest keeps Quests visible. */
export const barSlotsOf = (selection: PhoneSelection) => ({
  hasErrands: selection.quest !== null,
  hasQuests: selection.realm !== null || selection.quest !== null,
});

/** One entry a sheet offers: a realm, a quest, or an errand of the chosen quest. */
export type Choice =
  | { readonly kind: "realm"; readonly realm: PhoneRealm }
  | { readonly id: MissionId; readonly kind: "quest" }
  | { readonly id: ThreadId; readonly kind: "errand" };

/** What choosing an entry of a sheet asks of the window, which then lands in that entry's chat. */
export const chosenEventOf = (choice: Choice, selection: PhoneSelection): NavigationEvent | null => {
  if (choice.kind === "realm") return { listing: listingOfRealm(choice.realm), type: "channel" };
  // A quest opens as its own thread, so choosing the one on show keeps its conversation as it is.
  if (choice.kind === "quest") return { id: null, missionId: choice.id, type: "thread" };
  return selection.quest === null ? null : { id: choice.id, missionId: selection.quest, type: "thread" };
};

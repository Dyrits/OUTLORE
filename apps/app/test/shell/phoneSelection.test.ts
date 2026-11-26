import type { MissionId, ThreadId } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { initialLocation, navigate } from "../../src/shell/location";
import {
  barSlotsOf,
  chosenEventOf,
  emptySelection,
  heldChoiceOf,
  listingOfRealm,
  type PhoneSelection,
  questRealmOf,
  realmOfListing,
  reconcileSelection,
  selectionOf,
  tappedTabOf,
} from "../../src/shell/phoneSelection";

const quest = "quest" as MissionId;
const other = "other" as MissionId;
const errand = "errand" as ThreadId;
const start = initialLocation(null);
const realm = { id: "realm", name: "Realm" };
const borderlands = { id: null, name: "Borderlands" };
const chosenRealm: PhoneSelection = { errand: null, quest: null, realm };
const chosenQuest: PhoneSelection = { errand: null, quest, realm };
const chosenErrand: PhoneSelection = { errand, quest, realm };

describe("tracking the bar's selection", () => {
  it("starts with nothing chosen, so the bar holds the Chronicle and Realms tabs only", () => {
    expect(barSlotsOf(emptySelection)).toEqual({ hasErrands: false, hasQuests: false });
  });

  it("chooses a realm when its channel shows, and so adds the Quests tab", () => {
    const channel = navigate(start, { listing: realm, type: "channel" });
    const selection = selectionOf(emptySelection, channel, null);
    expect(selection).toEqual(chosenRealm);
    expect(barSlotsOf(selection)).toEqual({ hasErrands: false, hasQuests: true });
  });

  it("reads the Borderlands as a realm with no id", () => {
    const channel = navigate(start, { listing: null, type: "channel" });
    expect(selectionOf(emptySelection, channel, null).realm).toEqual(borderlands);
    expect(realmOfListing(null)).toEqual(borderlands);
    expect(listingOfRealm(borderlands)).toBeNull();
    expect(listingOfRealm(realm)).toEqual(realm);
  });

  it("chooses a quest and its realm when the quest shows, and so adds the Errands tab", () => {
    const opened = navigate(start, { id: quest, type: "quest" });
    const selection = selectionOf(emptySelection, opened, realm);
    expect(selection).toEqual(chosenQuest);
    expect(barSlotsOf(selection)).toEqual({ hasErrands: true, hasQuests: true });
  });

  it("chooses an errand when it shows, and keeps it while its quest shows again", () => {
    const inErrand = navigate(navigate(start, { id: quest, type: "quest" }), {
      id: errand,
      missionId: quest,
      type: "thread",
    });
    expect(selectionOf(chosenQuest, inErrand, realm)).toEqual(chosenErrand);
    const backInQuest = navigate(inErrand, { id: null, missionId: quest, type: "thread" });
    expect(selectionOf(chosenErrand, backInQuest, realm)).toBe(chosenErrand);
  });

  it("drops the errand when another quest shows", () => {
    const next = navigate(start, { id: other, type: "quest" });
    expect(selectionOf(chosenErrand, next, realm)).toEqual({ errand: null, quest: other, realm });
  });

  it("keeps its choice on the Chronicle and on the places of the side menu, so the tabs lead back", () => {
    for (const place of ["Chronicle", "Lore", "Settings"] as const)
      expect(selectionOf(chosenErrand, navigate(start, { place, type: "place" }), null)).toBe(chosenErrand);
  });

  it("keeps the quest and errand when the same realm's channel shows, and drops them for another realm", () => {
    expect(selectionOf(chosenErrand, navigate(start, { listing: realm, type: "channel" }), null)).toBe(chosenErrand);
    const elsewhere = navigate(start, { listing: { id: "second", name: "Second" }, type: "channel" });
    expect(selectionOf(chosenErrand, elsewhere, null)).toEqual({
      errand: null,
      quest: null,
      realm: { id: "second", name: "Second" },
    });
    expect(selectionOf(chosenErrand, navigate(start, { listing: null, type: "channel" }), null)).toEqual({
      errand: null,
      quest: null,
      realm: borderlands,
    });
  });

  it("keeps the realm it had while a quest's realm is not known yet", () => {
    const opened = navigate(start, { id: quest, type: "quest" });
    expect(selectionOf(chosenRealm, opened, null).realm).toEqual(realm);
  });

  it("keeps the Quests tab visible when a quest is chosen before its realm is known", () => {
    expect(barSlotsOf({ errand: null, quest, realm: null })).toEqual({ hasErrands: true, hasQuests: true });
  });

  it("clears archived or deleted realms, quests and errands from the bar once they are no longer open", () => {
    const active = { missions: [{ id: quest }], workspaces: [{ id: "realm" }] };
    expect(reconcileSelection(chosenErrand, active, start)).toBe(chosenErrand);
    const archivedQuest = { missions: [], workspaces: [{ id: "realm" }] };
    // While the archived quest itself is open, keep it in the bar; once elsewhere, clear it.
    expect(reconcileSelection(chosenQuest, archivedQuest, navigate(start, { id: quest, type: "quest" }))).toBe(
      chosenQuest,
    );
    expect(reconcileSelection(chosenErrand, archivedQuest, start)).toEqual(chosenRealm);
    // An archived or deleted realm clears the whole chain.
    expect(reconcileSelection(chosenErrand, { missions: [], workspaces: [] }, start)).toEqual(emptySelection);
    // A deleted or archived errand is cleared once its quest's threads load and it is not open.
    const questThreads = {
      missionId: quest,
      threads: [{ id: errand, isArchived: true, parentId: "top" as ThreadId }],
    };
    expect(reconcileSelection(chosenErrand, active, start, questThreads)).toEqual(chosenQuest);
    expect(
      reconcileSelection(
        chosenErrand,
        active,
        navigate(start, { id: errand, missionId: quest, type: "thread" }),
        questThreads,
      ),
    ).toBe(chosenErrand);
  });

  it("names a quest's realm from the mission list, the Borderlands for a quest with none", () => {
    expect(questRealmOf({ workspaceId: "realm", workspaceName: "Realm" })).toEqual(realm);
    expect(questRealmOf({ workspaceId: null, workspaceName: null })).toEqual(borderlands);
    expect(questRealmOf(null)).toBeNull();
  });
});

describe("tapping a bar tab", () => {
  it("shows the choice the tab holds, as the event that lands in its chat", () => {
    expect(tappedTabOf("realms", chosenRealm)).toEqual({
      event: { listing: realm, type: "channel" },
      kind: "navigate",
    });
    expect(tappedTabOf("realms", { ...chosenRealm, realm: borderlands })).toEqual({
      event: { listing: null, type: "channel" },
      kind: "navigate",
    });
    expect(tappedTabOf("quests", chosenQuest)).toEqual({
      event: { id: null, missionId: quest, type: "thread" },
      kind: "navigate",
    });
    expect(tappedTabOf("errands", chosenErrand)).toEqual({
      event: { id: errand, missionId: quest, type: "thread" },
      kind: "navigate",
    });
  });

  it("opens the sheet that makes the choice while there is none", () => {
    expect(tappedTabOf("realms", emptySelection)).toEqual({ choice: "realm", kind: "choose" });
    expect(tappedTabOf("quests", chosenRealm)).toEqual({ choice: "quest", kind: "choose" });
    expect(tappedTabOf("errands", chosenQuest)).toEqual({ choice: "errand", kind: "choose" });
  });

  it("dismisses an open sheet without navigating when tapping the tab already on show", () => {
    expect(tappedTabOf("realms", chosenRealm, "realms")).toEqual({ kind: "dismiss" });
    expect(tappedTabOf("quests", chosenQuest, "quests")).toEqual({ kind: "dismiss" });
    expect(tappedTabOf("errands", chosenErrand, "errands")).toEqual({ kind: "dismiss" });
  });
});

describe("holding a bar tab", () => {
  it("opens the sheet of what the tab stands for, to change the choice", () => {
    expect(heldChoiceOf("realms", chosenErrand)).toBe("realm");
    expect(heldChoiceOf("quests", chosenErrand)).toBe("quest");
    expect(heldChoiceOf("errands", chosenErrand)).toBe("errand");
  });

  it("asks for the parent first when it is not chosen", () => {
    expect(heldChoiceOf("quests", emptySelection)).toBe("realm");
    expect(heldChoiceOf("errands", emptySelection)).toBe("realm");
    expect(heldChoiceOf("errands", chosenRealm)).toBe("quest");
  });
});

describe("choosing in a sheet", () => {
  it("lands in the chat of what was chosen", () => {
    expect(chosenEventOf({ kind: "realm", realm }, chosenQuest)).toEqual({ listing: realm, type: "channel" });
    expect(chosenEventOf({ kind: "realm", realm: borderlands }, chosenQuest)).toEqual({
      listing: null,
      type: "channel",
    });
    expect(chosenEventOf({ id: other, kind: "quest" }, chosenRealm)).toEqual({
      id: null,
      missionId: other,
      type: "thread",
    });
    expect(chosenEventOf({ id: errand, kind: "errand" }, chosenQuest)).toEqual({
      id: errand,
      missionId: quest,
      type: "thread",
    });
  });

  it("opens no errand while no quest is chosen", () => {
    expect(chosenEventOf({ id: errand, kind: "errand" }, chosenRealm)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { initialLocation, navigate, panelScopeOf } from "../../src/shell/location";
import { windowViewOf } from "../../src/shell/windowView";

// Identifiers normally arrive branded from the service.
const quest = "quest" as import("@outlore/contracts").MissionId;
const ritual = "ritual" as import("@outlore/contracts").MissionId;
const thread = "thread" as import("@outlore/contracts").ThreadId;

describe("opening the window", () => {
  it("starts on the home screen, and resumes a destination that needs no selection", () => {
    expect(initialLocation(null).place).toBe("Home");
    expect(initialLocation("Lore").place).toBe("Lore");
    expect(initialLocation("Settings").place).toBe("Settings");
  });
  it("opens the home screen for a destination that no longer exists", () => {
    for (const retired of ["Guildmaster", "Quests", "Craft", "Library", "Charter", "Rituals"])
      expect(initialLocation(retired).place).toBe("Home");
  });
});

describe("navigating the window", () => {
  it("returns from a channel quest to the same realm and Quests request", () => {
    const listing = { id: "realm", name: "Realm" };
    const channel = navigate(initialLocation(null), { listing, showQuests: true, type: "channel" });
    const opened = navigate(channel, { id: quest, origin: "channel", type: "quest" });
    expect(windowViewOf(opened).questReturn).toBe("channel");
    const back = navigate(opened, { type: "backFromQuest" });
    expect(back.openMission).toBeNull();
    expect(back.isQuestsOpen).toBe(false);
    expect(windowViewOf(back).channel?.id).toBe(listing.id);
    expect(windowViewOf(back).channel?.questsRequest).toBe(channel.listRequest);
  });

  it("returns from a Chronicle quest or errand to the Chronicle", () => {
    const chronicle = navigate(initialLocation(null), { place: "Chronicle", type: "place" });
    const opened = navigate(chronicle, { id: quest, origin: "chronicle", type: "quest" });
    expect(windowViewOf(opened).questReturn).toBe("chronicle");
    const errand = navigate(opened, { id: thread, missionId: quest, type: "thread" });
    expect(windowViewOf(errand).questReturn).toBe("chronicle");
    const back = navigate(errand, { type: "backFromQuest" });
    expect(back.openMission).toBeNull();
    expect(back.openThread).toBeNull();
    expect(back.place).toBe("Chronicle");
    expect(back.isQuestsOpen).toBe(false);
  });

  it("returns an errand the Chronicle opened itself to the Chronicle", () => {
    const chronicle = navigate(initialLocation(null), { place: "Chronicle", type: "place" });
    const errand = navigate(chronicle, { id: thread, missionId: quest, origin: "chronicle", type: "thread" });
    expect(windowViewOf(errand).questReturn).toBe("chronicle");
    expect(navigate(errand, { type: "backFromQuest" }).place).toBe("Chronicle");
  });

  it("opens the Quests tab when backing out of a quest picked directly from it", () => {
    const channel = navigate(initialLocation(null), { listing: null, type: "channel" });
    const opened = navigate(channel, { id: quest, type: "quest" });
    expect(navigate(opened, { type: "backFromQuest" }).isQuestsOpen).toBe(true);
    // Also when the Chronicle is the place beneath the tab: a Quests pick is not a Chronicle pick.
    const inChronicle = navigate(initialLocation(null), { place: "Chronicle", type: "place" });
    const picked = navigate({ ...inChronicle, isQuestsOpen: true }, { id: quest, type: "quest" });
    expect(navigate(picked, { type: "backFromQuest" }).isQuestsOpen).toBe(true);
  });

  it("returns a quest Chronicler opened to Chronicler's tab, and not to the Quests tab", () => {
    const chronicler = navigate(initialLocation(null), { isOpen: true, type: "narrowChronicler" });
    const opened = navigate(chronicler, { id: quest, origin: "chronicler", type: "quest" });
    expect(opened.isNarrowChroniclerOpen).toBe(false);
    expect(windowViewOf(opened).questReturn).toBe("chronicler");
    const back = navigate(opened, { type: "backFromQuest" });
    expect(back.openMission).toBeNull();
    expect(back.isNarrowChroniclerOpen).toBe(true);
    expect(back.isQuestsOpen).toBe(false);
  });

  it("keeps the quest mounted beneath the Quests tab it backed out to", () => {
    const opened = navigate(initialLocation(null), { id: quest, type: "quest" });
    const back = navigate(opened, { type: "backFromQuest" });
    expect(back.openMission).toBe(quest);
    expect(back.isQuestsOpen).toBe(true);
  });

  it("opens the requested realm or Borderlands on its Quests tab on every press", () => {
    for (const listing of [{ id: "realm", name: "Realm" }, null]) {
      const action = { listing, showQuests: true, type: "channel" } as const;
      const first = navigate(initialLocation(null), action);
      const second = navigate(first, action);
      expect(windowViewOf(first).channel?.id).toBe(listing?.id ?? null);
      expect(windowViewOf(first).channel?.questsRequest).toEqual({ tab: "quests" });
      expect(windowViewOf(second).channel?.questsRequest).not.toBe(windowViewOf(first).channel?.questsRequest);
      expect(windowViewOf(navigate(second, { listing, type: "channel" })).channel?.questsRequest).toBeNull();
    }
  });
  it("opens the quest itself on Errands, including when an errand was selected", () => {
    const before = navigate(initialLocation(null), { id: thread, missionId: quest, type: "thread" });
    const next = navigate(before, { id: quest, showErrands: true, type: "quest" });
    expect(windowViewOf(next)).toMatchObject({
      errandsRequest: { tab: "errands" },
      openMission: quest,
      openThread: null,
    });
    expect(windowViewOf(navigate(next, { id: quest, type: "quest" })).errandsRequest).toBeNull();
  });
  it("uncovers a quest opened from the narrow window's Chronicler", () => {
    const covered = navigate(initialLocation(null), { isOpen: true, type: "narrowChronicler" });
    const next = navigate(covered, { id: quest, type: "quest" });
    expect(next.openMission).toBe(quest);
    expect(next.isNarrowChroniclerOpen).toBe(false);
  });
  it("closes Journal, Lore and Budget when choosing an errand without remounting the quest", () => {
    const opened = navigate(initialLocation(null), { id: quest, type: "quest" });
    for (const page of [
      { kind: "journal" },
      { id: thread, kind: "lore", title: "Thread" },
      { kind: "budget", scope: "Mission" },
    ] as const) {
      const next = navigate(navigate(opened, { page, type: "page" }), { id: thread, missionId: quest, type: "thread" });
      expect(next.page).toBeNull();
      expect(next.openThread).toBe(thread);
      expect(next.openCount).toBe(opened.openCount);
    }
  });
  it("closes the thread selection with its quest", () => {
    const next = navigate(navigate(initialLocation(null), { id: thread, missionId: quest, type: "thread" }), {
      type: "close",
    });
    expect(next.openMission).toBeNull();
    expect(next.openThread).toBeNull();
  });
  it("keeps the narrow window's Menu, Quests tab and Chronicler exclusive and closes all on a destination", () => {
    const chronicler = navigate(initialLocation(null), { isOpen: true, type: "narrowChronicler" });
    const menu = navigate(chronicler, { isOpen: true, type: "menu" });
    expect(menu.isNarrowChroniclerOpen).toBe(false);
    expect(menu.isMenuOpen).toBe(true);
    const quests = navigate(menu, { isOpen: true, type: "quests" });
    expect(quests).toMatchObject({ isMenuOpen: false, isNarrowChroniclerOpen: false, isQuestsOpen: true });
    const again = navigate(quests, { isOpen: true, type: "narrowChronicler" });
    expect(again).toMatchObject({ isMenuOpen: false, isNarrowChroniclerOpen: true, isQuestsOpen: false });
    for (const open of [menu, quests, again])
      expect(navigate(open, { place: "Settings", type: "place" })).toMatchObject({
        isMenuOpen: false,
        isNarrowChroniclerOpen: false,
        isQuestsOpen: false,
        place: "Settings",
      });
  });
  it("closes the Menu again, leaving the screen beneath it as it was", () => {
    const lore = navigate(initialLocation(null), { place: "Lore", type: "place" });
    const menu = navigate(lore, { isOpen: true, type: "menu" });
    const closed = navigate(menu, { isOpen: false, type: "menu" });
    expect(closed.place).toBe("Lore");
    expect(closed.isMenuOpen).toBe(false);
  });
  it("returns an archived quest to its parent realm's channel", () => {
    const next = navigate(initialLocation(null), {
      quest: { workspaceId: "realm", workspaceName: "Realm" },
      type: "parent",
    });
    expect(next.place).toBe("Channel");
    expect(next.listedRealm).toEqual({ id: "realm", name: "Realm" });
  });
  it("clears host-specific selections and coverings when choosing another host", () => {
    const next = navigate(
      {
        ...initialLocation(null),
        guildmasterRealm: "/realm",
        openMission: quest,
        openThread: thread,
      },
      { type: "host" },
    );
    expect(next).toMatchObject({
      guildmasterRealm: null,
      openMission: null,
      openThread: null,
    });
  });
  it("scopes the panel to its page without changing scope for a covering layer", () => {
    const initial = initialLocation(null);
    expect(panelScopeOf(navigate(initial, { isOpen: true, type: "narrowChronicler" }))).toEqual(panelScopeOf(initial));
    expect(panelScopeOf(navigate(initial, { page: { kind: "journal" }, type: "page" }))).not.toEqual(
      panelScopeOf(initial),
    );
  });
});

describe("the Workshop icon", () => {
  it("opens the Workshop, and a second press goes back to where the owner was", () => {
    const inQuest = navigate(initialLocation(null), { id: quest, type: "quest" });
    const inWorkshop = navigate(inQuest, { type: "workshop" });
    expect(inWorkshop.place).toBe("Settings");
    expect(inWorkshop.openMission).toBeNull();
    const back = navigate(inWorkshop, { type: "workshop" });
    expect(back.place).toBe(inQuest.place);
    expect(back.openMission).toBe(quest);
    expect(back.workshopReturn).toBeNull();
  });

  it("goes to the home screen when the Workshop was opened by other means", () => {
    const opened = navigate(initialLocation("Settings"), { type: "workshop" });
    expect(opened.place).toBe("Home");
  });

  it("forgets where to go back to once the owner goes elsewhere", () => {
    const inWorkshop = navigate(navigate(initialLocation(null), { id: quest, type: "quest" }), { type: "workshop" });
    const elsewhere = navigate(inWorkshop, { id: "other" as typeof quest, type: "quest" });
    expect(elsewhere.workshopReturn).toBeNull();
    expect(navigate(elsewhere, { type: "workshop" }).place).toBe("Settings");
  });

  it("keeps its way back while the owner moves inside the Workshop", () => {
    const inWorkshop = navigate(navigate(initialLocation(null), { id: quest, type: "quest" }), { type: "workshop" });
    const inSection = navigate(inWorkshop, { section: "permissions", type: "section" });
    expect(navigate(inSection, { type: "workshop" }).openMission).toBe(quest);
  });
});

describe("the Ritual form over the conversation area", () => {
  it("covers a quest without leaving it, and Back returns to the same panes", () => {
    const inQuest = navigate(initialLocation(null), { id: quest, type: "quest" });
    const covered = navigate(inQuest, {
      target: { kind: "create", originMissionId: quest, realmPath: null },
      type: "ritualForm",
    });
    expect(covered.ritualForm).toEqual({ kind: "create", originMissionId: quest, realmPath: null });
    // The quest stays open beneath the form, so its panes wait as they were and keep their state.
    expect(covered.openMission).toBe(quest);
    const back = navigate(covered, { target: null, type: "ritualForm" });
    expect(back.ritualForm).toBeNull();
    expect(back.openMission).toBe(quest);
    expect(back.openCount).toBe(inQuest.openCount);
  });

  it("closes with a destination, so a saved Ritual replaces the form with its conversation", () => {
    const covered = navigate(navigate(initialLocation(null), { id: quest, type: "quest" }), {
      target: { kind: "create", originMissionId: null, realmPath: "/realm" },
      type: "ritualForm",
    });
    const saved = navigate(covered, { id: ritual, type: "quest" });
    expect(saved.ritualForm).toBeNull();
    expect(saved.openMission).toBe(ritual);
  });

  it("closes the Menu and the Quests tab it was opened from, as any newly opened screen's own coverings", () => {
    const menu = navigate(initialLocation(null), { isOpen: true, type: "menu" });
    const quests = navigate(initialLocation(null), { isOpen: true, type: "quests" });
    for (const from of [menu, quests]) {
      const covered = navigate(from, {
        target: { kind: "create", originMissionId: null, realmPath: null },
        type: "ritualForm",
      });
      expect(covered.isMenuOpen).toBe(false);
      expect(covered.isQuestsOpen).toBe(false);
    }
    const covered = navigate(menu, {
      target: { kind: "create", originMissionId: null, realmPath: null },
      type: "ritualForm",
    });
    expect(windowViewOf(covered).ritualForm).toEqual({ kind: "create", originMissionId: null, realmPath: null });
  });
});

import { describe, expect, it } from "vitest";
import { initialLocation, navigate, panelScopeOf } from "../../src/shell/location";
import { windowViewOf } from "../../src/shell/windowView";

// Identifiers normally arrive branded from the service.
const quest = "quest" as import("@outlore/contracts").MissionId;
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
  it("keeps the narrow menu and Chronicler exclusive and closes both on a destination", () => {
    const chronicler = navigate(initialLocation(null), { isOpen: true, type: "narrowChronicler" });
    const menu = navigate(chronicler, { isOpen: true, type: "menu" });
    expect(menu.isNarrowChroniclerOpen).toBe(false);
    expect(navigate(menu, { place: "Settings", type: "place" }).isMenuOpen).toBe(false);
  });
  it("returns an archived quest to its parent realm", () => {
    const next = navigate(initialLocation(null), {
      quest: { workspaceId: "realm", workspaceName: "Realm" },
      type: "parent",
    });
    expect(next.place).toBe("RealmQuests");
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

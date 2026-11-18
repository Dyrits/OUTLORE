import { describe, expect, it } from "vitest";
import { initialLocation, navigate, panelScopeOf } from "../../src/shell/location";

// Identifiers normally arrive branded from the service.
const quest = "quest" as import("@outlore/contracts").MissionId;
const thread = "thread" as import("@outlore/contracts").ThreadId;

describe("opening the window", () => {
  it("starts on the home screen, and resumes a destination that needs no selection", () => {
    expect(initialLocation(null).place).toBe("Home");
    expect(initialLocation("Rituals").place).toBe("Rituals");
    expect(initialLocation("Settings").place).toBe("Settings");
  });
  it("opens the home screen for a destination that no longer exists", () => {
    for (const retired of ["Guildmaster", "Quests", "Craft", "Library", "Charter"])
      expect(initialLocation(retired).place).toBe("Home");
  });
});

describe("navigating the window", () => {
  it("uncovers a quest opened from expanded or narrow Chronicler", () => {
    for (const type of ["full", "narrowChronicler"] as const) {
      const covered = navigate(initialLocation(null), { isOpen: true, type });
      const next = navigate(covered, { id: quest, type: "quest" });
      expect(next.openMission).toBe(quest);
      expect(next.isChroniclerFull).toBe(false);
      expect(next.isNarrowChroniclerOpen).toBe(false);
    }
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
        isChroniclerFull: true,
        openMission: quest,
        openThread: thread,
      },
      { type: "host" },
    );
    expect(next).toMatchObject({
      guildmasterRealm: null,
      isChroniclerFull: false,
      openMission: null,
      openThread: null,
    });
  });
  it("scopes the panel to its page without changing scope for a covering layer", () => {
    const initial = initialLocation(null);
    expect(panelScopeOf(navigate(initial, { isOpen: true, type: "full" }))).toEqual(panelScopeOf(initial));
    expect(panelScopeOf(navigate(initial, { page: { kind: "journal" }, type: "page" }))).not.toEqual(
      panelScopeOf(initial),
    );
  });
});

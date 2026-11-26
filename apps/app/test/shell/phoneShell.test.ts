import type { MissionId, ThreadId } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { initialLocation, navigate } from "../../src/shell/location";
import type { PhoneRealm } from "../../src/shell/phoneSelection";
import {
  barBottomGap,
  barClearanceOf,
  barHeight,
  chronicleEvent,
  phoneBackOf,
  phoneShellOf,
  phoneTabs,
  withOpacity,
} from "../../src/shell/phoneShell";

const quest = "quest" as MissionId;
const errand = "errand" as ThreadId;
const start = initialLocation(null);
const realm: PhoneRealm = { id: "realm", name: "Realm" };
const listing = { id: "realm", name: "Realm" };

describe("choosing the phone's tabs", () => {
  it("are the Chronicle, Realms, Quests and Errands, in that order", () => {
    expect(phoneTabs.map((tab) => tab.label)).toEqual(["Chronicle", "Realms", "Quests", "Errands"]);
  });

  it("start on the Chronicle, with the bar and the top bar naming it", () => {
    expect(phoneShellOf(start, false)).toMatchObject({
      hasBar: true,
      tab: "chronicle",
      title: "Chronicle",
    });
    expect(phoneShellOf(navigate(start, chronicleEvent), false).tab).toBe("chronicle");
  });

  it("light Realms on a realm's channel, which is a conversation the top bar leaves to its own header", () => {
    const channel = navigate(start, { listing, type: "channel" });
    expect(phoneShellOf(channel, false)).toMatchObject({
      hasBar: true,
      tab: "realms",
      title: null,
    });
    expect(phoneShellOf(navigate(start, { listing: null, type: "channel" }), false).tab).toBe("realms");
  });

  it("light Quests on a quest and Errands on an errand, both conversations", () => {
    const opened = navigate(start, { id: quest, type: "quest" });
    expect(phoneShellOf(opened, false)).toMatchObject({ hasBar: true, tab: "quests" });
    const inErrand = navigate(opened, { id: errand, missionId: quest, type: "thread" });
    expect(phoneShellOf(inErrand, false)).toMatchObject({ hasBar: true, tab: "errands" });
    expect(phoneShellOf(navigate(inErrand, { id: null, missionId: quest, type: "thread" }), false).tab).toBe("quests");
  });

  it("have a conversation keep clear of the bar, so its composer sits above it", () => {
    const opened = navigate(start, { id: quest, type: "quest" });
    expect(phoneShellOf(opened, false).isClearOfBar).toBe(true);
    expect(phoneShellOf(navigate(start, { listing: null, type: "channel" }), false).isClearOfBar).toBe(true);
  });
});

describe("showing or hiding the bar", () => {
  it("is absent under the Ritual form and the quest panel, which have their own buttons", () => {
    const opened = navigate(start, { id: quest, type: "quest" });
    expect(phoneShellOf(opened, true).hasBar).toBe(false);
    const form = navigate(opened, {
      target: { kind: "create", originMissionId: null, realmPath: null },
      type: "ritualForm",
    });
    expect(phoneShellOf(form, false).hasBar).toBe(false);
    expect(phoneShellOf(navigate(start, chronicleEvent), true).hasBar).toBe(false);
  });

  it("stays under a place of the side menu, with no tab lit and the place named in the top bar", () => {
    const shellOf = (place: "Lore" | "Archived" | "Reserves" | "Settings") =>
      phoneShellOf(navigate(start, { place, type: "place" }), false);
    expect([shellOf("Lore"), shellOf("Archived"), shellOf("Reserves"), shellOf("Settings")]).toMatchObject([
      { hasBar: true, tab: null, title: "Lore" },
      { hasBar: true, tab: null, title: "Archive" },
      { hasBar: true, tab: null, title: "Reserves" },
      { hasBar: true, tab: null, title: "Settings" },
    ]);
  });

  it("keeps the screens that cannot scroll beneath the bar clear of it", () => {
    const clear = (place: "Lore" | "Archived" | "Reserves" | "Settings" | "Chronicle") =>
      phoneShellOf(navigate(start, { place, type: "place" }), false).isClearOfBar;
    expect([clear("Chronicle"), clear("Lore"), clear("Archived"), clear("Reserves")]).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(clear("Settings")).toBe(true);
  });
});

describe("sizing the bar's clearance", () => {
  it("clears the bar, its gap and a little more", () => {
    expect(barClearanceOf(barBottomGap.web)).toBeGreaterThan(barHeight + barBottomGap.web);
    expect(barClearanceOf(barBottomGap.native)).toBeGreaterThan(barClearanceOf(barBottomGap.web));
  });

  it("gives a six-digit color an opacity, and leaves any other color as it is", () => {
    expect(withOpacity("#172230", 0.92)).toBe("#172230eb");
    expect(withOpacity("#172230", 2)).toBe("#172230ff");
    expect(withOpacity("rgba(0,0,0,.5)", 0.9)).toBe("rgba(0,0,0,.5)");
  });
});

describe("pressing the phone's Back", () => {
  const press = (location: typeof start, realmHeld = realm, showsDetails = false) => {
    const back = phoneBackOf(location, showsDetails, realmHeld);
    return back === null || back.type === "closeChooser" || back.type === "closeDetails"
      ? location
      : navigate(location, back);
  };

  it("leaves the app only from the Chronicle", () => {
    expect(phoneBackOf(start, false, null)).toBeNull();
  });

  it("goes from an errand to its quest, then to its realm's channel, then to the Chronicle", () => {
    const inErrand = navigate(navigate(start, { id: quest, type: "quest" }), {
      id: errand,
      missionId: quest,
      type: "thread",
    });
    const toQuest = press(inErrand);
    expect(toQuest).toMatchObject({ openMission: quest, openThread: null });
    const toRealm = press(toQuest);
    expect(toRealm).toMatchObject({ listedRealm: listing, openMission: null, place: "Channel" });
    const toChronicle = press(toRealm);
    expect(toChronicle.place).toBe("Chronicle");
    expect(phoneBackOf(toChronicle, false, realm)).toBeNull();
  });

  it("returns the Borderlands' quest to the Borderlands' channel", () => {
    const toRealm = press(navigate(start, { id: quest, type: "quest" }), { id: null, name: "Borderlands" });
    expect(toRealm).toMatchObject({ listedRealm: null, openMission: null, place: "Channel" });
  });

  it("returns a quest to the Chronicle it was opened from, whatever realm the bar holds", () => {
    const opened = navigate(start, { id: quest, origin: "chronicle", type: "quest" });
    expect(press(opened)).toMatchObject({ openMission: null, place: "Chronicle" });
  });

  it("returns a quest to the Chronicle while the bar holds no realm yet", () => {
    const opened = navigate(start, { id: quest, type: "quest" });
    expect(phoneBackOf(opened, false, null)).toEqual({ type: "backFromQuest" });
  });

  it("closes the chooser sheet, quest panel, a quest page and the side menu one layer at a time", () => {
    const open = navigate(start, { id: quest, type: "quest" });
    expect(phoneBackOf(open, false, realm, true)).toEqual({ type: "closeChooser" });
    expect(phoneBackOf(open, true, realm)).toEqual({ type: "closeDetails" });
    const paged = navigate(open, { page: { kind: "budget" } as never, type: "page" });
    expect(press(paged).page).toBeNull();
    const menu = navigate(open, { isOpen: true, type: "menu" });
    expect(press(menu).isMenuOpen).toBe(false);
  });

  it("closes the side menu before a chooser sheet behind it, and closes the errand starter without leaving the quest", () => {
    const inErrand = navigate(navigate(start, { id: quest, type: "quest" }), {
      id: errand,
      missionId: quest,
      type: "thread",
    });
    const menu = navigate(inErrand, { isOpen: true, type: "menu" });
    expect(phoneBackOf(menu, false, realm, true)).toEqual({ isOpen: false, type: "menu" });
    const starting = navigate(inErrand, { isOpen: true, type: "errandStarter" });
    expect(phoneShellOf(starting, false)).toEqual({
      hasBar: false,
      isClearOfBar: false,
      tab: null,
      title: "New errand",
    });
    expect(phoneBackOf(starting, false, realm)).toEqual({ isOpen: false, type: "errandStarter" });
    expect(press(starting)).toMatchObject({ isErrandStarterOpen: false, openMission: quest, openThread: errand });
  });

  it("returns a place of the side menu to the Chronicle", () => {
    const lore = navigate(start, { place: "Lore", type: "place" });
    expect(press(lore).place).toBe("Chronicle");
  });
});

import type { MissionId } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { initialLocation, navigate } from "../../src/shell/location";
import {
  initialPillScroll,
  phoneShellOf,
  phoneTabEventOf,
  phoneTabs,
  pillBottomGap,
  pillClearanceOf,
  pillHeight,
  pillScrollOf,
  withOpacity,
} from "../../src/shell/phoneShell";

const quest = "quest" as MissionId;
const start = initialLocation(null);

describe("the phone's tabs", () => {
  it("are the Chronicle, Quests and Chronicler, in that order", () => {
    expect(phoneTabs.map((tab) => tab.label)).toEqual(["Chronicle", "Quests", "Chronicler"]);
  });

  it("start on the Chronicle, with the pill and the top bar naming it", () => {
    expect(phoneShellOf(start, false)).toMatchObject({
      bottom: "pill",
      cover: null,
      tab: "chronicle",
      title: "Chronicle",
    });
    const chronicle = navigate(start, { place: "Chronicle", type: "place" });
    expect(phoneShellOf(chronicle, false).tab).toBe("chronicle");
  });

  it("light the tab each choice opens, and each tab is a full screen of its own", () => {
    for (const tab of phoneTabs) {
      const next = navigate(start, phoneTabEventOf(tab.id));
      const shell = phoneShellOf(next, false);
      expect(shell.tab).toBe(tab.id);
      expect(shell.bottom).toBe("pill");
      expect(shell.title).toBe(tab.label);
    }
    expect(phoneShellOf(navigate(start, phoneTabEventOf("quests")), false).cover).toBe("quests");
    expect(phoneShellOf(navigate(start, phoneTabEventOf("chronicler")), false).cover).toBe("chronicler");
    expect(phoneShellOf(navigate(start, phoneTabEventOf("chronicle")), false).cover).toBeNull();
  });

  it("go from one tab to another, leaving no cover of the one before", () => {
    const chronicler = navigate(start, phoneTabEventOf("chronicler"));
    const quests = navigate(chronicler, phoneTabEventOf("quests"));
    expect(phoneShellOf(quests, false).cover).toBe("quests");
    const chronicle = navigate(quests, phoneTabEventOf("chronicle"));
    expect(phoneShellOf(chronicle, false)).toMatchObject({ cover: null, tab: "chronicle" });
  });

  it("keep a realm's channel under the Quests tab", () => {
    const channel = navigate(start, { listing: { id: "realm", name: "Realm" }, type: "channel" });
    expect(phoneShellOf(channel, false)).toMatchObject({ bottom: "pill", cover: null, tab: "quests" });
  });
});

describe("the pill and the composer", () => {
  it("gives way to the conversation's own composer in a quest or errand", () => {
    const opened = navigate(start, { id: quest, type: "quest" });
    expect(phoneShellOf(opened, false)).toMatchObject({ bottom: "composer", tab: null });
  });

  it("is back once the Quests tab, the Menu or Chronicler covers a quest", () => {
    const opened = navigate(start, { id: quest, type: "quest" });
    expect(phoneShellOf(navigate(opened, { type: "backFromQuest" }), false)).toMatchObject({
      bottom: "pill",
      cover: "quests",
      tab: "quests",
    });
    expect(phoneShellOf(navigate(opened, { isOpen: true, type: "menu" }), false).bottom).toBe("pill");
    expect(phoneShellOf(navigate(opened, { isOpen: true, type: "narrowChronicler" }), false).bottom).toBe("pill");
  });

  it("is absent under the Ritual form and the quest panel, which have their own buttons", () => {
    const opened = navigate(start, { id: quest, type: "quest" });
    expect(phoneShellOf(opened, true).bottom).toBe("none");
    const form = navigate(opened, {
      target: { kind: "create", originMissionId: null, realmPath: null },
      type: "ritualForm",
    });
    expect(phoneShellOf(form, false).bottom).toBe("none");
    expect(phoneShellOf(navigate(start, { place: "Chronicle", type: "place" }), true).bottom).toBe("none");
  });
});

describe("the Menu", () => {
  it("covers the content with no tab lit, named in the top bar", () => {
    const menu = navigate(start, { isOpen: true, type: "menu" });
    expect(phoneShellOf(menu, false)).toMatchObject({ bottom: "pill", cover: "menu", tab: null, title: "Menu" });
  });

  it("opens a place with the pill still there and no tab lit", () => {
    for (const place of ["Lore", "Archived", "Reserves", "Settings"] as const) {
      const shell = phoneShellOf(
        navigate(navigate(start, { isOpen: true, type: "menu" }), { place, type: "place" }),
        false,
      );
      expect(shell).toMatchObject({ bottom: "pill", cover: null, tab: null });
    }
  });

  it("names each place in the top bar, which goes back to the Menu, and no other screen has that Back", () => {
    const shellOf = (place: "Lore" | "Archived" | "Reserves" | "Settings" | "Chronicle" | "Channel") =>
      phoneShellOf(navigate(start, { place, type: "place" }), false);
    expect([shellOf("Lore"), shellOf("Archived"), shellOf("Reserves"), shellOf("Settings")]).toMatchObject([
      { hasBack: true, title: "Lore" },
      { hasBack: true, title: "Archive" },
      { hasBack: true, title: "Reserves" },
      { hasBack: true, title: "Settings" },
    ]);
    expect(shellOf("Chronicle").hasBack).toBe(false);
    expect(shellOf("Channel").hasBack).toBe(false);
    expect(phoneShellOf(navigate(start, { isOpen: true, type: "menu" }), false).hasBack).toBe(false);
  });

  it("keeps the screens that cannot scroll beneath the pill clear of it", () => {
    const clear = (place: "Lore" | "Archived" | "Reserves" | "Settings" | "Chronicle" | "Channel") =>
      phoneShellOf(navigate(start, { place, type: "place" }), false).isClearOfPill;
    expect(clear("Chronicle")).toBe(false);
    expect(clear("Lore")).toBe(false);
    expect(clear("Archived")).toBe(false);
    expect(clear("Reserves")).toBe(false);
    expect(clear("Settings")).toBe(true);
    expect(clear("Channel")).toBe(true);
    expect(phoneShellOf(navigate(start, phoneTabEventOf("chronicler")), false).isClearOfPill).toBe(true);
  });
});

describe("the pill's collapse while scrolling", () => {
  it("stays whole near the top of a screen", () => {
    expect(pillScrollOf(initialPillScroll, 30).isCollapsed).toBe(false);
  });

  it("shrinks to a circle on a scroll down past the threshold, and returns on a scroll up", () => {
    const down = pillScrollOf(initialPillScroll, 120);
    expect(down.isCollapsed).toBe(true);
    const further = pillScrollOf(down, 200);
    expect(further.isCollapsed).toBe(true);
    expect(pillScrollOf(further, 150).isCollapsed).toBe(false);
  });

  it("ignores a tremor smaller than the slop", () => {
    const down = pillScrollOf(initialPillScroll, 300);
    expect(pillScrollOf(down, 296)).toBe(down);
    const up = pillScrollOf(down, 280);
    expect(up.isCollapsed).toBe(false);
    expect(pillScrollOf(up, 284)).toBe(up);
  });

  it("returns at the top however far the owner came", () => {
    expect(pillScrollOf(pillScrollOf(initialPillScroll, 900), 10).isCollapsed).toBe(false);
  });
});

describe("the pill's room", () => {
  it("clears the pill, its gap and a little more", () => {
    expect(pillClearanceOf(pillBottomGap.web)).toBeGreaterThan(pillHeight + pillBottomGap.web);
    expect(pillClearanceOf(pillBottomGap.native)).toBeGreaterThan(pillClearanceOf(pillBottomGap.web));
  });

  it("gives a six-digit color an opacity, and leaves any other color as it is", () => {
    expect(withOpacity("#172230", 0.92)).toBe("#172230eb");
    expect(withOpacity("#172230", 2)).toBe("#172230ff");
    expect(withOpacity("rgba(0,0,0,.5)", 0.9)).toBe("rgba(0,0,0,.5)");
  });
});

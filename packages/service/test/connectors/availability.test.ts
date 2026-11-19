import { describe, expect, it } from "vitest";
import {
  type ConnectorChoices,
  isToolOffered,
  isUsableBy,
  noChoices,
  type Standing,
  type Subject,
  type SwitchChoice,
} from "../../src/connectors/availability.ts";

const standing = (changes: Partial<Standing> = {}): Standing => ({
  choices: noChoices,
  isConnected: true,
  isEnabled: true,
  isInstalled: true,
  isRemoving: false,
  ...changes,
});
const choices = (
  borderlands: SwitchChoice | null,
  realms: Array<[string, SwitchChoice]> = [],
  quests: Array<[string, SwitchChoice]> = [],
): ConnectorChoices => ({ borderlands, quests: new Map(quests), realms: new Map(realms) });
const quest = (realmId: string | null, missionId = "q1"): Subject => ({ _tag: "Quest", missionId, realmId });

describe("whether a connector is usable by a subject", () => {
  it("is usable by default once installed and connected, by every kind of subject", () => {
    expect(isUsableBy(standing(), quest(null))).toBe(true);
    expect(isUsableBy(standing(), quest("r1"))).toBe(true);
    expect(isUsableBy(standing(), { _tag: "Chronicler" })).toBe(true);
  });

  it("is not usable until installed and connected, nor while it is being removed", () => {
    expect(isUsableBy(standing({ isInstalled: false }), quest(null))).toBe(false);
    expect(isUsableBy(standing({ isConnected: false }), quest(null))).toBe(false);
    expect(isUsableBy(standing({ isRemoving: true }), quest(null))).toBe(false);
  });

  it("is unusable everywhere with the global switch off, whatever any choice says", () => {
    const everyChoice: Array<SwitchChoice | null> = [null, "On", "Off"];
    for (const borderlands of everyChoice)
      for (const realm of everyChoice)
        for (const own of everyChoice) {
          const given = choices(borderlands, realm === null ? [] : [["r1", realm]], own === null ? [] : [["q1", own]]);
          for (const subject of [quest(null), quest("r1"), { _tag: "Chronicler" } as Subject])
            expect(isUsableBy(standing({ choices: given, isEnabled: false }), subject)).toBe(false);
        }
  });

  it("takes a quest's own choice over its realm's and the Borderlands'", () => {
    expect(isUsableBy(standing({ choices: choices(null, [["r1", "Off"]], [["q1", "On"]]) }), quest("r1"))).toBe(true);
    expect(isUsableBy(standing({ choices: choices(null, [["r1", "On"]], [["q1", "Off"]]) }), quest("r1"))).toBe(false);
    expect(isUsableBy(standing({ choices: choices("Off", [], [["q1", "On"]]) }), quest(null))).toBe(true);
  });

  it("takes a quest's realm's choice when the quest has none, and the global switch when the realm has none", () => {
    expect(isUsableBy(standing({ choices: choices(null, [["r1", "Off"]]) }), quest("r1"))).toBe(false);
    expect(isUsableBy(standing({ choices: choices(null, [["r1", "Off"]]) }), quest("r2"))).toBe(true);
    expect(isUsableBy(standing({ choices: choices(null, [["r1", "On"]]) }), quest("r1"))).toBe(true);
  });

  it("uses the Borderlands' choice only for a quest in no realm: a quest in a realm that inherits is on", () => {
    // The counterexample to reading placement as a chain: global on, Borderlands Off, a realm that inherits.
    const borderlandsOff = standing({ choices: choices("Off") });
    expect(isUsableBy(borderlandsOff, quest("r1"))).toBe(true);
    expect(isUsableBy(borderlandsOff, quest(null))).toBe(false);
  });

  it("lets Chronicler follow the global switch alone, whatever the Borderlands, a realm or a quest chose", () => {
    const everything = standing({ choices: choices("Off", [["r1", "Off"]], [["q1", "Off"]]) });
    expect(isUsableBy(everything, { _tag: "Chronicler" })).toBe(true);
  });

  it("follows a quest's placement as it is read, so a moved quest keeps its own choice and takes its new placement's", () => {
    const given = standing({ choices: choices(null, [["r1", "Off"]], [["q1", "On"]]) });
    expect(isUsableBy(given, quest("r1", "q1"))).toBe(true);
    const inherited = standing({ choices: choices(null, [["r1", "Off"]]) });
    expect(isUsableBy(inherited, quest("r1", "q2"))).toBe(false);
    expect(isUsableBy(inherited, quest("r2", "q2"))).toBe(true);
  });
});

describe("whether a thread is offered a tool", () => {
  const tools = { chosenApps: null, offTools: new Set<string>() };

  it("offers a tool of a usable connector unless the tool is switched off", () => {
    expect(isToolOffered(standing(), tools, { app: null, name: "list" }, quest(null))).toBe(true);
    expect(
      isToolOffered(standing(), { ...tools, offTools: new Set(["list"]) }, { app: null, name: "list" }, quest(null)),
    ).toBe(false);
    expect(
      isToolOffered(standing(), { ...tools, offTools: new Set(["list"]) }, { app: null, name: "other" }, quest(null)),
    ).toBe(true);
  });

  it("offers a tool of an unusable connector to nobody", () => {
    expect(isToolOffered(standing({ isEnabled: false }), tools, { app: null, name: "list" }, quest(null))).toBe(false);
  });

  it("offers an app's tool only when the app is chosen, and a tool of no known app never", () => {
    const apps = { chosenApps: new Set(["calendar"]), offTools: new Set<string>() };
    expect(isToolOffered(standing(), apps, { app: "calendar", name: "list" }, quest(null))).toBe(true);
    expect(isToolOffered(standing(), apps, { app: "mail", name: "read" }, quest(null))).toBe(false);
    expect(isToolOffered(standing(), apps, { app: null, name: "stray" }, quest(null))).toBe(false);
  });
});

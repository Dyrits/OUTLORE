import { describe, expect, it } from "vitest";
import { choiceOfSwitch, choiceViewOf, globalOffNote } from "../../src/connectors/connectorChoices";
import { appsAfterToggle, toolGroupsOf } from "../../src/connectors/connectorWords";
import { leftBehindOf, storingRefusalOf } from "../../src/connectors/vaultWords";

describe("choosing connectors in the Charter", () => {
  it("shows an inherited realm choice and permits resetting an explicit choice", () => {
    expect(choiceViewOf({ choice: null, inherited: "Off", inheritedFrom: "Realm", isEnabled: true })).toEqual({
      canReset: false,
      isDisabled: false,
      isOn: false,
      note: "Inherited from the realm",
    });
    expect(choiceViewOf({ choice: "On", inherited: "Off", inheritedFrom: "Realm", isEnabled: true })).toEqual({
      canReset: true,
      isDisabled: false,
      isOn: true,
      note: null,
    });
    expect(choiceOfSwitch(false)).toBe("Off");
  });

  it("shows the global switch overriding an explicit choice", () => {
    expect(choiceViewOf({ choice: "On", inherited: "On", inheritedFrom: null, isEnabled: false })).toEqual({
      canReset: true,
      isDisabled: true,
      isOn: false,
      note: globalOffNote,
    });
  });

  it("limits Apple tools to chosen apps and keeps the other choices on a toggle", () => {
    const apps = [
      { id: "calendar", isChosen: true, name: "Calendar" },
      { id: "mail", isChosen: false, name: "Mail" },
    ];
    const tools = [
      { app: "calendar", class: "Read" as const, description: "Read calendar", isOn: true, name: "read" },
      { app: "mail", class: "Write" as const, description: "Send mail", isOn: true, name: "send" },
    ];
    expect(toolGroupsOf({ apps, tools })).toEqual([{ heading: "Calendar", tools: [tools[0]] }]);
    expect(appsAfterToggle({ apps }, "mail", true)).toEqual(["calendar", "mail"]);
  });

  it("shows the Vault's actual refusal, with no step to take for it", () => {
    const protection = {
      isAllowed: false,
      reason: "Claude Code is unverified",
      unverified: [{ harness: "Claude Code", reason: "No stamp" }],
    };
    expect(storingRefusalOf({ protection, state: "Absent", stateReason: null })).toBe("Claude Code is unverified");
    expect(storingRefusalOf({ protection, state: "Locked", stateReason: "Keychain locked" })).toBe("Keychain locked");
  });

  it("lists in the Vault only the secrets no connector panel holds", () => {
    const card = (id: string, state: string) =>
      ({ id, name: id, secretKinds: ["API key"], state }) as unknown as Parameters<typeof leftBehindOf>[0][number];
    const entry = (connectorId: string) =>
      ({ addedAt: "2026-11-19T00:00:00Z", connectorId, kind: "API key" }) as unknown as Parameters<
        typeof leftBehindOf
      >[1][number];
    const cards = [card("composio", "Ready"), card("gone", "Removing"), card("other", "NotInstalled")];
    const slots = leftBehindOf(cards, [entry("composio"), entry("gone"), entry("other"), entry("unknown")]);
    expect(slots.map((slot) => slot.connectorId)).toEqual(["gone", "other", "unknown"]);
  });
});

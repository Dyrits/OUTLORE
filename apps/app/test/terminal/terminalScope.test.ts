import { describe, expect, it } from "vitest";
import { bareTerminalIdOf, isTerminalAvailable, terminalKeyOf } from "../../src/terminal/terminalScope";

describe("whether this screen may open a terminal", () => {
  it("always opens one on the host's own window, settings or no settings", () => {
    expect(isTerminalAvailable({ isNativeApp: false, isRemoteHost: false }, null)).toBe(true);
    expect(
      isTerminalAvailable({ isNativeApp: false, isRemoteHost: false }, { shouldAllowRemoteTerminals: false }),
    ).toBe(true);
  });

  it("opens one on a paired device's screens only while the host's switch allows it", () => {
    expect(isTerminalAvailable({ isNativeApp: false, isRemoteHost: true }, null)).toBe(false);
    expect(isTerminalAvailable({ isNativeApp: false, isRemoteHost: true }, { shouldAllowRemoteTerminals: false })).toBe(
      false,
    );
    expect(isTerminalAvailable({ isNativeApp: false, isRemoteHost: true }, { shouldAllowRemoteTerminals: true })).toBe(
      true,
    );
  });

  it("stays off on the native app, which has no shell surface yet", () => {
    expect(isTerminalAvailable({ isNativeApp: true, isRemoteHost: false }, null)).toBe(false);
    expect(isTerminalAvailable({ isNativeApp: true, isRemoteHost: true }, { shouldAllowRemoteTerminals: true })).toBe(
      false,
    );
  });
});

describe("the key one conversation's shell is named by", () => {
  it("carries its thread and starting folder, with the owner's home when there is none", () => {
    expect(bareTerminalIdOf("quest", "/code/realm")).toBe("quest:/code/realm");
    expect(bareTerminalIdOf("quest", null)).toBe("quest:home");
  });

  it("becomes its full key with the asking screen's scope, as the frames carry it", () => {
    expect(terminalKeyOf("host", "quest:/code/realm")).toBe("host:quest:/code/realm");
    expect(terminalKeyOf("remote", "quest:home")).toBe("remote:quest:home");
  });
});

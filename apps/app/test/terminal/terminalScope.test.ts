import { describe, expect, it } from "vitest";
import {
  bareTerminalIdOf,
  clampTerminalHeight,
  commandTerminalStatusOf,
  isTerminalAvailable,
  maxTerminalHeight,
  minTerminalHeight,
  terminalKeyOf,
} from "../../src/terminal/terminalScope";

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

describe("the inline terminal status and height bounds", () => {
  it("reports running, clean exit, non-zero exit code, and unknown exit", () => {
    expect(commandTerminalStatusOf({ _tag: "Running" })).toBe("Running…");
    expect(commandTerminalStatusOf({ _tag: "Exited", exitCode: 0 })).toBe("Finished");
    expect(commandTerminalStatusOf({ _tag: "Exited", exitCode: 1 })).toBe("Did not finish (exit 1)");
    expect(commandTerminalStatusOf({ _tag: "Exited", exitCode: null })).toBe("Ended");
  });

  it("clamps dragged terminal heights to the readable range", () => {
    expect(clampTerminalHeight(50)).toBe(minTerminalHeight);
    expect(clampTerminalHeight(320.4)).toBe(320);
    expect(clampTerminalHeight(2000)).toBe(maxTerminalHeight);
  });
});

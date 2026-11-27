import { describe, expect, it } from "vitest";
import {
  bareTerminalIdOf,
  clampTerminalHeight,
  commandTerminalStatusOf,
  isTerminalAvailable,
  maxTerminalHeight,
  minTerminalHeight,
  nextTerminalRunActionOf,
  shouldAutoRestartTerminalOf,
  terminalCommandInputOf,
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

describe("running a command in the conversation terminal", () => {
  it("formats a command for PTY submission with carriage returns", () => {
    expect(terminalCommandInputOf("git status")).toBe("git status\r");
    expect(terminalCommandInputOf("echo one\necho two")).toBe("echo one\recho two\r");
    expect(terminalCommandInputOf("echo one\r\necho two")).toBe("echo one\recho two\r");
  });

  it("writes immediately when the shell is ready and running", () => {
    expect(nextTerminalRunActionOf({ isReady: true, isRunning: true })).toBe("write");
  });

  it("restarts the shell when it is ready but has already exited", () => {
    expect(nextTerminalRunActionOf({ isReady: true, isRunning: false })).toBe("restart");
  });

  it("retries opening when a prior OpenTerminal attempt failed", () => {
    expect(nextTerminalRunActionOf({ hasOpenFailed: true, isReady: false, isRunning: true })).toBe("reopen");
    expect(nextTerminalRunActionOf({ hasOpenFailed: true, isReady: false, isRestarting: true, isRunning: true })).toBe(
      "queue",
    );
  });

  it("queues the command while the shell is still opening or already restarting", () => {
    expect(nextTerminalRunActionOf({ isReady: false, isRunning: true })).toBe("queue");
    expect(nextTerminalRunActionOf({ isReady: false, isRunning: false })).toBe("queue");
    expect(nextTerminalRunActionOf({ isReady: true, isRestarting: true, isRunning: false })).toBe("queue");
  });

  it("auto-restarts an exited shell at most once when commands are queued", () => {
    expect(shouldAutoRestartTerminalOf({ hasAutoRestarted: false, hasPendingCommands: true, isRunning: false })).toBe(
      true,
    );
    expect(shouldAutoRestartTerminalOf({ hasAutoRestarted: true, hasPendingCommands: true, isRunning: false })).toBe(
      false,
    );
    expect(shouldAutoRestartTerminalOf({ hasAutoRestarted: false, hasPendingCommands: false, isRunning: false })).toBe(
      false,
    );
    expect(shouldAutoRestartTerminalOf({ hasAutoRestarted: false, hasPendingCommands: true, isRunning: true })).toBe(
      false,
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  acceptsCopilotVersionLine,
  copilotAccountEnvVariables,
  copilotAcpArgs,
  copilotDeviceCodeSignInArgs,
  copilotExecutable,
  copilotProviderProfile,
  copilotSignedOutCode,
  copilotSignInArgs,
  copilotSignInEnv,
  copilotSignOutArgs,
  copilotSpawnEnv,
  copilotSupportsAddedAccounts,
  copilotUpdateArgs,
} from "../../src/harness/copilotProvider.ts";

// The pinned registration facts of the GitHub Copilot provider, each verified against the pinned upstream
// nightly-labs/openbot b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0 during the fourth-wave survey: registration
// reads these instead of re-deriving them, and a failed check here means the survey's evidence moved.

describe("the pinned Copilot provider facts", () => {
  it("uses the copilot executable and the audited ACP launch with its update squeeze", () => {
    expect(copilotExecutable).toBe("copilot");
    expect(copilotAcpArgs).toEqual(["--acp", "--no-auto-update"]);
    expect([...copilotAcpArgs]).toEqual(copilotProviderProfile.args);
    expect(copilotSpawnEnv).toEqual({ COPILOT_AUTO_UPDATE: "false" });
    expect(copilotProviderProfile.env).toEqual({ COPILOT_AUTO_UPDATE: "false" });
  });

  it("accepts the version line of the audited CLI", () => {
    expect(acceptsCopilotVersionLine("Copilot CLI 1.0.105")).toBe(true);
    expect(acceptsCopilotVersionLine("Copilot CLI v2.1.0")).toBe(true);
    expect(acceptsCopilotVersionLine("1.2.3")).toBe(true);
    expect(acceptsCopilotVersionLine("copilot, no version here")).toBe(false);
  });

  it("sets the browser-callback sign-in with the update squeeze, and no sign-out or update command", () => {
    expect(copilotSignInArgs).toEqual(["login"]);
    expect(copilotDeviceCodeSignInArgs).toEqual(["login", "--device-code"]);
    expect(copilotSignInEnv).toEqual({ COPILOT_AUTO_UPDATE: "false" });
    expect(copilotSignOutArgs).toBeNull();
    expect(copilotUpdateArgs).toBeNull();
  });

  it("reads the signed-out session answer by its pinned code", () => {
    expect(copilotSignedOutCode).toBe(-32000);
  });

  it("takes the computer's own sign-in only, with no added-account support to adopt", () => {
    expect(copilotSupportsAddedAccounts).toBe(false);
  });

  it("names the environment that would select another account, in the CLI's own order of preference", () => {
    expect(copilotAccountEnvVariables).toEqual(["COPILOT_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"]);
  });

  it("declares no state home to redirect, the computer-sign-in-only shape", () => {
    expect(copilotProviderProfile.stateHomeEnv).toBeUndefined();
    expect(copilotProviderProfile.needsConfiguredStateHome).toBeUndefined();
    expect(copilotProviderProfile.minMajorVersion).toBeUndefined();
  });
});

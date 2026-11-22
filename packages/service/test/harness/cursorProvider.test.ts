import { describe, expect, it } from "vitest";
import {
  acceptsCursorVersionLine,
  cursorAccountEnvVariables,
  cursorAcpArgs,
  cursorAddedAccountEvidence,
  cursorExecutable,
  cursorNoUsageEvidence,
  cursorProviderProfile,
  cursorSignInArgs,
  cursorSignInEnv,
  cursorSignOutArgs,
  cursorSupportsAddedAccounts,
  cursorUpdateArgs,
} from "../../src/harness/cursorProvider.ts";

// The pinned registration facts of the Cursor provider, each verified against the pinned upstream
// nightly-labs/openbot b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0 during the fourth-wave survey: registration
// reads these instead of re-deriving them, and a failed check here means the survey's evidence moved.

describe("the pinned Cursor provider facts", () => {
  it("uses the cursor-agent executable and the audited ACP launch", () => {
    expect(cursorExecutable).toBe("cursor-agent");
    expect(cursorAcpArgs).toEqual(["acp"]);
    expect(cursorProviderProfile.args).toEqual(["acp"]);
    expect(cursorProviderProfile.env).toEqual({});
  });

  it("accepts the date-build version line of the audited generation", () => {
    expect(acceptsCursorVersionLine("2026.09.28-64d2043")).toBe(true);
    expect(acceptsCursorVersionLine("2026.10.01-10-52-16-3f8a2b1c")).toBe(true);
    expect(acceptsCursorVersionLine("  2026.09.28-64d2043\n")).toBe(true);
    expect(acceptsCursorVersionLine("0.1.2")).toBe(false);
    expect(acceptsCursorVersionLine("2026.09.28")).toBe(false);
    expect(acceptsCursorVersionLine("Cursor 2026.09.28-64d2043")).toBe(false);
  });

  it("sets the terminal link sign-in, the CLI sign-out, and no update command", () => {
    expect(cursorSignInArgs).toEqual(["login"]);
    expect(cursorSignInEnv).toEqual({ NO_OPEN_BROWSER: "1" });
    expect(cursorSignOutArgs).toEqual(["logout"]);
    expect(cursorUpdateArgs).toBeNull();
  });

  it("takes the computer's own sign-in only, with the key-account path named as excluded", () => {
    expect(cursorSupportsAddedAccounts).toBe(false);
    expect(cursorAddedAccountEvidence).toContain("b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0");
    expect(cursorAddedAccountEvidence).toContain("provider-drivers.ts:972-974");
    expect(cursorAddedAccountEvidence).toContain("CURSOR_API_KEY");
    expect(cursorAddedAccountEvidence).toContain("AGENT_CLI_CREDENTIAL_STORE=memory");
    expect(cursorAddedAccountEvidence).toContain("openbot-integration-parity-2026-11-22.md");
  });

  it("names the environment that would change the sign-in, in the account variables a registration must know", () => {
    expect(cursorAccountEnvVariables).toEqual(["CURSOR_API_KEY", "CURSOR_AUTH_TOKEN", "AGENT_CLI_CREDENTIAL_STORE"]);
  });

  it("carries no usage surface and cites the credential-reading path it refuses", () => {
    expect(cursorNoUsageEvidence).toContain("b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0");
    expect(cursorNoUsageEvidence).toContain("providers.md:1106");
    expect(cursorNoUsageEvidence).toContain("api2.cursor.sh");
    expect(cursorNoUsageEvidence).toContain("cursor-usage.ts");
  });

  it("declares no state home to redirect, the computer-sign-in-only shape", () => {
    expect(cursorProviderProfile.stateHomeEnv).toBeUndefined();
    expect(cursorProviderProfile.needsConfiguredStateHome).toBeUndefined();
    expect(cursorProviderProfile.minMajorVersion).toBeUndefined();
  });
});

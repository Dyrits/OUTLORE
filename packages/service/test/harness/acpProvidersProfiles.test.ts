import { describe, expect, it } from "vitest";
import { acceptsAcpProviderVersion, acpProviderProfiles } from "../../src/harness/acpProviderProfiles.ts";

describe("ACP provider launch profiles", () => {
  it("uses the provider's ACP entry point and disables detached Cline sessions", () => {
    expect(acpProviderProfiles.antigravity.args).toEqual(["acp"]);
    expect(acpProviderProfiles.cursor.args).toEqual(["acp"]);
    expect(acpProviderProfiles.cline.args).toEqual(["--acp"]);
    expect(acpProviderProfiles.cline.env.CLINE_SESSION_BACKEND_MODE).toBe("local");
    expect(acpProviderProfiles.kimi.args).toEqual(["acp"]);
    expect(acpProviderProfiles.devin.args).toEqual(["acp"]);
    expect(acpProviderProfiles.copilot.args).toEqual(["--acp", "--no-auto-update"]);
    expect(acpProviderProfiles.hermes.args).toEqual(["acp"]);
  });

  it("isolates Kimi state and keeps its dangerous-command guard forced on", () => {
    expect(acpProviderProfiles.kimi.env.KIMI_CODE_DANGEROUS_COMMAND_GUARD).toBe("true");
    expect(acpProviderProfiles.kimi.env.KIMI_CODE_NO_AUTO_UPDATE).toBe("1");
    expect(acpProviderProfiles.kimi.stateHomeEnv).toBe("KIMI_CODE_HOME");
  });

  it("takes Hermes's configured account home as its state home", () => {
    expect(acpProviderProfiles.hermes.stateHomeEnv).toBe("HERMES_HOME");
    expect(acpProviderProfiles.hermes.needsConfiguredStateHome).toBe(true);
  });

  it("accepts only the audited Kimi binary generation", () => {
    const kimi = acpProviderProfiles.kimi;
    expect(acceptsAcpProviderVersion(kimi, "2.7.2")).toBe(true);
    expect(acceptsAcpProviderVersion(kimi, "kimi, version 2.7.2")).toBe(true);
    expect(acceptsAcpProviderVersion(kimi, "kimi, version 1.6")).toBe(false);
    expect(acceptsAcpProviderVersion(kimi, "1.6")).toBe(false);
    expect(acceptsAcpProviderVersion(kimi, "")).toBe(false);
    expect(acceptsAcpProviderVersion(kimi, "unknown")).toBe(false);
  });

  it("accepts any version of profiles audited without a generation gate", () => {
    expect(acceptsAcpProviderVersion(acpProviderProfiles.cursor, "0.0.1")).toBe(true);
    expect(acceptsAcpProviderVersion(acpProviderProfiles.cursor, "unknown")).toBe(false);
  });
});

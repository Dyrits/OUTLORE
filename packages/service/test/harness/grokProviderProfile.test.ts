import { describe, expect, it } from "vitest";
import {
  grokBlockEvidence,
  grokPermissionMode,
  grokRuntimeArgs,
  grokRuntimeEnabled,
  grokRuntimeRefusal,
} from "../../src/harness/grok.ts";

// Grok's runtime stays blocked (ADR 0007): its native subagents act with the session's own privileges, and
// the only upstream switch that silences them, --no-subagents, is passed on the profile-generation branches
// alone. These checks pin the evidence and the fail-closed refusal a registration attempt reads.

describe("the blocked Grok runtime", () => {
  it("refuses the runtime with the evidence that keeps it blocked", () => {
    expect(grokRuntimeEnabled).toBe(false);
    expect(grokRuntimeRefusal().reason).toBe(grokBlockEvidence);
  });

  it("names upstream's own source, commit, and the branches that pass the switch", () => {
    expect(grokBlockEvidence).toContain("nightly-labs/openbot b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0");
    expect(grokBlockEvidence).toContain("src/backend/grok-client.ts");
    expect(grokBlockEvidence).toContain("--no-subagents");
    expect(grokBlockEvidence).toContain("profile-generation");
    expect(grokBlockEvidence).toContain('"--permission-mode", "default", "agent", "stdio"');
  });

  it("settles the launch profile the runtime will use once unblocked", () => {
    expect(grokRuntimeArgs).toEqual(["agent", "stdio"]);
    expect(grokPermissionMode).toBe("default");
  });
});

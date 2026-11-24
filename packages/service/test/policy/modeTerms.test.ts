import { describe, expect, it } from "vitest";
import type { ModeTerms } from "../../src/core/index.ts";
import { capabilities, isUnaskedUnder } from "../../src/policy/index.ts";
import { modeTerms, termsOfMode } from "../../src/work/threadPermissionMode.ts";

// The permission modes (CHG-0617, CHG-0621) are one table from mode to terms: every reader judges from the terms, so
// a fifth mode is one more row and no change to a reader.

describe("the permission mode table", () => {
  it("states what each of the four modes means", () => {
    expect(modeTerms).toEqual({
      Auto: {
        approvalLevel: "RiskyOnly",
        areEditsUnasked: false,
        canWorkOutsideSandbox: false,
        isEverythingUnasked: false,
      },
      AutoAcceptEdits: {
        approvalLevel: "CommandsAndEdits",
        areEditsUnasked: true,
        canWorkOutsideSandbox: false,
        isEverythingUnasked: false,
      },
      FullAccess: {
        approvalLevel: "RiskyOnly",
        areEditsUnasked: false,
        canWorkOutsideSandbox: true,
        isEverythingUnasked: true,
      },
      Supervised: {
        approvalLevel: "CommandsAndEdits",
        areEditsUnasked: false,
        canWorkOutsideSandbox: false,
        isEverythingUnasked: false,
      },
    });
    expect(termsOfMode("FullAccess")).toBe(modeTerms.FullAccess);
  });

  it("judges an action from the terms alone, so a fifth mode is one row", () => {
    const editsOnly: ModeTerms = {
      approvalLevel: "CommandsAndEdits",
      areEditsUnasked: true,
      canWorkOutsideSandbox: false,
      isEverythingUnasked: false,
    };
    expect(isUnaskedUnder(editsOnly, "Edit", null)).toBe(true);
    expect(isUnaskedUnder(editsOnly, "Edit", capabilities.fileOutsideWorkspace)).toBe(false);
    expect(isUnaskedUnder(editsOnly, "Bash", null)).toBe(false);
    expect(isUnaskedUnder(modeTerms.FullAccess, "Bash", capabilities.outsideSandbox)).toBe(true);
    expect(isUnaskedUnder(modeTerms.FullAccess, "Permissions", capabilities.widenSandbox)).toBe(false);
    expect(isUnaskedUnder(modeTerms.Auto, "Bash", null)).toBe(true);
    expect(isUnaskedUnder(modeTerms.Supervised, "Bash", null)).toBe(false);
  });
});

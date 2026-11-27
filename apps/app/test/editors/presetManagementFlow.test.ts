import { describe, expect, it } from "vitest";
import { afterSaveAs } from "../../src/editors/presetChain";
import { nextStep } from "../../src/editors/presetManagementFlow";

describe("deleting a saved preset", () => {
  it("asks to confirm before it deletes", () => {
    expect(nextStep({ kind: "ask" })).toEqual({ error: null, stage: "confirming" });
  });

  it("goes back to nothing asked on Cancel", () => {
    expect(nextStep({ kind: "cancel" })).toEqual({ error: null, stage: "idle" });
  });

  it("disables the buttons while it deletes", () => {
    expect(nextStep({ kind: "start" }).stage).toBe("deleting");
  });

  it("keeps the confirmation and shows the message when the service refuses", () => {
    expect(nextStep({ kind: "failed", message: "In use" })).toEqual({ error: "In use", stage: "confirming" });
  });

  it("clears everything once the preset is deleted", () => {
    expect(nextStep({ kind: "done" })).toEqual({ error: null, stage: "idle" });
  });
});

describe("saving a draft as a new preset", () => {
  it("sends the source preset back to its saved chain and drops the draft from the list", () => {
    expect(afterSaveAs()).toEqual({ discardSource: true, listDraft: null });
  });
});

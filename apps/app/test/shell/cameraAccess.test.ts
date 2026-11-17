import { describe, expect, it } from "vitest";
import { cameraAccessOf } from "../../src/shell/cameraAccess";

describe("what the scanner does with the camera permission", () => {
  it("waits while the permission is still being read", () => {
    expect(cameraAccessOf(null)).toEqual({ kind: "loading" });
  });

  it("shows the camera once it is allowed", () => {
    expect(cameraAccessOf({ canAskAgain: true, granted: true, status: "granted" })).toEqual({ kind: "granted" });
  });

  it("asks the first time, when nothing was decided", () => {
    expect(cameraAccessOf({ canAskAgain: true, granted: false, status: "undetermined" })).toEqual({ kind: "ask" });
  });

  it("asks again after a refusal the system lets it ask again after", () => {
    expect(cameraAccessOf({ canAskAgain: true, granted: false, status: "denied" })).toEqual({ kind: "ask" });
  });

  it("says how to allow it once the system will not ask again, and offers to paste instead", () => {
    const access = cameraAccessOf({ canAskAgain: false, granted: false, status: "denied" });
    expect(access.kind).toBe("blocked");
    if (access.kind !== "blocked") return;
    expect(access.message).toContain("Settings");
    expect(access.message).toContain("Camera");
    expect(access.message).toContain("paste");
  });
});

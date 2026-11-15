import { describe, expect, it } from "vitest";
import { bounceDesktopDock } from "../../src/foundation/desktopAttention";

describe("bounceDesktopDock", () => {
  it("asks the desktop app to bounce its Dock icon", async () => {
    let asked = 0;
    await bounceDesktopDock({ requestAttention: async () => void asked++ });
    expect(asked).toBe(1);
  });

  it("shows nothing when the desktop app cannot bounce the icon", async () => {
    await expect(
      bounceDesktopDock({
        requestAttention: () => Promise.reject(new Error("The Dock is only called from Outlore's desktop window.")),
      }),
    ).resolves.toBeUndefined();
  });

  it("does nothing without a desktop app", async () => {
    await expect(bounceDesktopDock(undefined)).resolves.toBeUndefined();
  });
});

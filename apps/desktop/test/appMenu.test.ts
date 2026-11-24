import { describe, expect, it, vi } from "vitest";
import { appMenuTemplateOf } from "../src/appMenu.ts";

const workshopItems = (template: ReturnType<typeof appMenuTemplateOf>) =>
  template
    .flatMap((menu) => (Array.isArray(menu.submenu) ? menu.submenu : []))
    .filter((item) => item.label === "Workshop…");

describe("the menu bar", () => {
  it("offers the Workshop in File and, on macOS, in the app menu, each with ⌘,", () => {
    const open = vi.fn();
    const items = workshopItems(appMenuTemplateOf("darwin", open));
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.accelerator).toBe("CmdOrCtrl+,");
      (item.click as () => void)();
    }
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("offers it in File alone elsewhere", () => {
    const template = appMenuTemplateOf("linux", () => {});
    expect(workshopItems(template)).toHaveLength(1);
    expect(template[0]?.label).toBe("File");
  });
});

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { iconFileOf, iconFiles } from "../src/appIcon.ts";

const assets = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");

describe("iconFileOf", () => {
  it("keeps Iskios's icon for the One color theme", () => {
    expect(iconFiles.one).toBe("icon.png");
    expect(iconFileOf("one")).toBe("icon.png");
  });

  it("keeps the original icon for the Black & white and Slate themes", () => {
    expect(iconFileOf("mono")).toBe("icon.png");
    expect(iconFileOf("slate")).toBe("icon.png");
  });

  it("gives the same icon for Iskios and for anything unknown, which is the default theme's", () => {
    expect(iconFileOf("iskios")).toBe("icon.png");
    expect(iconFileOf("sepia")).toBe("icon.png");
    expect(iconFileOf(undefined)).toBe("icon.png");
  });

  it("names an icon file that exists for every theme", () => {
    for (const file of Object.values(iconFiles)) expect(existsSync(join(assets, file))).toBe(true);
  });

  it("is not fooled by names an object inherits", () => {
    expect(iconFileOf("toString")).toBe("icon.png");
  });
});

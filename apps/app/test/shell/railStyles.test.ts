import { describe, expect, it } from "vitest";

// The styles import react-native, which the test runner cannot load, so the guard reads their source.
const sources = import.meta.glob(["../../src/shell/railStyles.ts", "../../src/shell/railQuests.tsx"], {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;
const source = sources["../../src/shell/railStyles.ts"] ?? "";
const row = sources["../../src/shell/railQuests.tsx"] ?? "";

describe("a realm's name in the sidebar", () => {
  it("takes its width from its text, not from `flex`", () => {
    // Yoga, the phone's layout, reads `flexBasis: "auto"` as unset, so a `flex: 1` beneath it still gives a basis of 0
    // and the name gets no width: the phone showed a realm's folder mark and no name.
    const block = /realmText: \{([^}]*)\}/.exec(source)?.[1] ?? "";
    expect(block).toContain("flexShrink: 1");
    expect(block).not.toMatch(/\bflex:|flexBasis|flexGrow/);
  });

  it("is not drawn on top of the quest rows' text style, which carries `flex: 1`", () => {
    expect(row).not.toContain("[local.rowText, local.realmText]");
  });
});

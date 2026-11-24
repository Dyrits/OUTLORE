import type { Tier } from "@outlore/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CustomPresets } from "../../src/settings/workshopCompanions";

// react-native loads only on a device or in a browser; react-native-web draws the same tree to static markup.
vi.mock("react-native", async () => await import("react-native-web"));
vi.mock("react-native-svg", () => ({ default: () => null, Path: () => null }));

const stack: Tier = { accountId: null, backups: [], effort: "high", harness: "claude", model: "opus" };
const draw = (props: { isDraft?: boolean; names: ReadonlyArray<string> }) =>
  renderToStaticMarkup(
    createElement(CustomPresets, {
      harnesses: null,
      isDraft: props.isDraft ?? false,
      onAdd: () => {},
      onFocus: () => {},
      presets: props.names.map((name) => ({ focus: `custom:${name}` as const, name, stack })),
      selected: "Light",
    }),
  );

describe("the Companions tab's list of custom presets", () => {
  it("says there are none yet and offers to add one", () => {
    const markup = draw({ names: [] });
    expect(markup).toContain("None yet.");
    expect(markup).toContain("+ Add preset");
  });

  it("lists every custom preset as a row, with a row to add one", () => {
    const markup = draw({ names: ["Research", "Reviews", "Docs"] });
    for (const name of ["Research", "Reviews", "Docs"]) expect(markup).toContain(name);
    expect(markup).toContain("+ Add preset");
  });

  it("marks the draft as a row of its own while a new preset is being made", () => {
    const markup = draw({ isDraft: true, names: ["Research"] });
    expect(markup).toContain("New preset");
    expect(markup).toContain("Not saved yet");
    expect(markup).not.toContain("+ Add preset");
  });
});

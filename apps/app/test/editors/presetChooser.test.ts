import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PresetChainEditor } from "../../src/editors/presetChainEditor";
import { PresetChooser } from "../../src/editors/presetChooser";
import { EffortBar } from "../../src/ui/effortBar";

const runner = (model: string) => ({ accountId: null, effort: "high" as const, harness: "claude" as const, model });
const heavy = { backups: [runner("claude-sonnet-5-5")], name: "Heavy", runner: runner("claude-opus-5-5") };
const entries = [{ isChosen: true, kind: "preset" as const, preset: heavy }];

const chooserMarkup = (draft: { name: string; stack: never } | null, isNav = true, extra: object = {}) =>
  renderToStaticMarkup(
    createElement(PresetChooser, {
      ...extra,
      drafts: draft === null ? {} : { [draft.name]: draft.stack },
      entries,
      harnesses: null,
      isNav,
      onPreset: () => {},
    }),
  );

describe("listing the presets beside the details", () => {
  it("lists each model of a preset's chain under its name", () => {
    const markup = chooserMarkup(null);
    expect(markup).toContain("Opus 5.5");
    expect(markup).toContain("Sonnet 5.5");
    expect(markup).not.toContain("unsaved");
  });

  it("shows the unsaved chain of the preset being edited, marked unsaved", () => {
    const markup = chooserMarkup({
      name: "Heavy",
      stack: {
        ...runner("claude-haiku-4-5"),
        backups: [runner("claude-opus-5-5"), runner("claude-sonnet-5-5")],
      } as never,
    });
    expect(markup).toContain("unsaved");
    expect(markup).toContain("Haiku 4.5");
    expect(markup).not.toContain("2 backups");
  });

  it("drops the summary line when the chain is listed", () => {
    expect(chooserMarkup(null)).not.toContain("1 backup");
    expect(chooserMarkup(null, false)).toContain("1 backup");
  });

  it("leaves another preset's row as it was", () => {
    const markup = chooserMarkup({ name: "Other", stack: { ...runner("claude-haiku-4-5"), backups: [] } as never });
    expect(markup).not.toContain("unsaved");
  });

  it("renders presets named like Object.prototype keys without treating inherited members as drafts or notes", () => {
    const inheritedEntries = [
      { isChosen: false, kind: "preset" as const, preset: { ...heavy, name: "constructor" } },
      { isChosen: false, kind: "preset" as const, preset: { ...heavy, name: "toString" } },
    ];
    const markup = renderToStaticMarkup(
      createElement(PresetChooser, {
        drafts: {},
        entries: inheritedEntries,
        harnesses: null,
        isChainListed: true,
        isNav: true,
        notes: {},
        onPreset: () => {},
      }),
    );
    expect(markup).toContain("constructor");
    expect(markup).toContain("toString");
    expect(markup).toContain("Opus 5.5");
    expect(markup).not.toContain("unsaved");
  });

  it("distinguishes rows that share a display name by their explicit id when looking up drafts and notes", () => {
    const duplicateNameEntries = [
      { id: "Default", isChosen: true, kind: "preset" as const, preset: { ...heavy, name: "Default" } },
      { id: "custom:Default", isChosen: false, kind: "preset" as const, preset: { ...heavy, name: "Default" } },
    ];
    const markup = renderToStaticMarkup(
      createElement(PresetChooser, {
        drafts: { "custom:Default": { ...runner("claude-haiku-4-5"), backups: [] } },
        entries: duplicateNameEntries,
        harnesses: null,
        isChainListed: true,
        isNav: true,
        notes: {},
        onPreset: () => {},
      }),
    );
    expect(markup).toContain("Opus 5.5");
    expect(markup).toContain("Haiku 4.5");
    expect(markup.match(/unsaved/g)).toHaveLength(1);
  });

  it("stacked, shows no chain under the name", () => {
    expect(chooserMarkup(null, false)).not.toContain("Sonnet 5.5 ·");
  });
});

describe("editing a preset not made yet", () => {
  const markup = renderToStaticMarkup(
    createElement(PresetChainEditor, {
      harnesses: null,
      isNew: true,
      name: "New preset",
      onSave: async () => {},
      onSaveAs: async () => {},
      stack: { ...runner("claude-opus-5-5"), backups: [] },
    }),
  );

  it("can only be saved under a name or discarded", () => {
    expect(markup).toContain("Not saved yet.");
    expect(markup).toContain("Save as new");
    expect(markup).toContain(">Discard<");
    expect(markup).not.toContain("Overwrite");
  });
});

describe("drawing the effort bar", () => {
  it("draws one segment for each level with the chosen one checked", () => {
    const markup = renderToStaticMarkup(
      createElement(EffortBar, {
        accessibilityLabel: "Effort",
        label: (option: string) => option,
        onChange: () => {},
        options: ["low", "medium", "high"],
        value: "medium",
      }),
    );
    expect(markup.match(/role="radio"/g)).toHaveLength(3);
    expect(markup.match(/aria-checked="true"/g)).toHaveLength(1);
  });
});

describe("controlling a draft in the chain editor", () => {
  const saved = { ...runner("claude-opus-5-5"), backups: [runner("claude-sonnet-5-5")] };
  const edited = { ...saved, backups: [] };
  const editorMarkup = (initial: typeof saved | null) =>
    renderToStaticMarkup(
      createElement(PresetChainEditor, {
        harnesses: null,
        initial,
        name: "Heavy",
        onSave: async () => undefined,
        onSaveAs: async () => undefined,
        stack: saved,
      }),
    );

  it("offers no Overwrite, Save as new or Discard while nothing changed", () => {
    const markup = editorMarkup(null);
    expect(markup).toContain("Nothing changed yet.");
    expect(markup).not.toContain("Discard");
    expect(markup).not.toContain("Overwrite");
  });

  it("resumes a kept draft with Overwrite, Save as new and Discard", () => {
    const markup = editorMarkup(edited);
    expect(markup).toContain("You changed this preset.");
    expect(markup).toContain("Overwrite");
    expect(markup).toContain("Save as new");
    expect(markup).toContain("Discard");
  });

  it("shows a kept draft's chain, not the saved one", () => {
    expect(editorMarkup(edited)).not.toContain("Order 2");
    expect(editorMarkup(null)).toContain("Order 2");
  });
});

describe("stacking the list in the Workshop panel", () => {
  it("lists each model under the preset's name though it is not the split navigation", () => {
    const markup = chooserMarkup(null, false, { isChainListed: true });
    expect(markup).toContain("Opus 5.5");
    expect(markup).toContain("Sonnet 5.5");
  });

  it("says a tier is not set in place of its chain", () => {
    const markup = chooserMarkup(null, false, {
      isChainListed: true,
      notes: { Heavy: "Not set: starts on the default Companion" },
    });
    expect(markup).toContain("Not set: starts on the default Companion");
    expect(markup).not.toContain("Opus 5.5");
  });
});

describe("marking the preset in edit mode", () => {
  it("is marked editing, apart from the thread's check mark", () => {
    expect(chooserMarkup(null, true, { editing: "Heavy" })).toContain("editing");
    expect(chooserMarkup(null, true)).not.toContain("editing");
  });

  it("says editing and unsaved together while its draft exists", () => {
    const stack = { ...runner("claude-haiku-4-5"), backups: [] } as never;
    expect(chooserMarkup({ name: "Heavy", stack }, true, { editing: "Heavy" })).toContain("editing · unsaved");
  });
});

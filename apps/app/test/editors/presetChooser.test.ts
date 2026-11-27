import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PresetChainEditor } from "../../src/editors/presetChainEditor";
import { PresetChooser } from "../../src/editors/presetChooser";
import { EffortBar } from "../../src/ui/effortBar";

const runner = (model: string) => ({ accountId: null, effort: "high" as const, harness: "claude" as const, model });
const heavy = { backups: [runner("claude-sonnet-5-5")], name: "Heavy", runner: runner("claude-opus-5-5") };
const entries = [{ isChosen: true, preset: heavy }];

const chooserMarkup = (draft: { name: string; stack: never } | null, extra: object = {}) =>
  renderToStaticMarkup(
    createElement(PresetChooser, {
      ...extra,
      drafts: draft === null ? {} : { [draft.name]: draft.stack },
      entries,
      harnesses: null,
      onPreset: () => {},
    }),
  );

describe("listing the companion cards", () => {
  it("lists each numbered model of a companion's chain under its name without a Presets header", () => {
    const markup = chooserMarkup(null);
    expect(markup).toContain("Opus 5.5");
    expect(markup).toContain("Sonnet 5.5");
    expect(markup).toContain("High");
    expect(markup).not.toContain(">Presets<");
    expect(markup).not.toContain("unsaved");
  });

  it("shows the unsaved chain of the companion being edited, marked unsaved", () => {
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

  it("leaves another companion's card as it was", () => {
    const markup = chooserMarkup({ name: "Other", stack: { ...runner("claude-haiku-4-5"), backups: [] } as never });
    expect(markup).not.toContain("unsaved");
  });

  it("renders companions named like Object.prototype keys without treating inherited members as drafts or notes", () => {
    const inheritedEntries = [
      { isChosen: false, preset: { ...heavy, name: "constructor" } },
      { isChosen: false, preset: { ...heavy, name: "toString" } },
    ];
    const markup = renderToStaticMarkup(
      createElement(PresetChooser, {
        drafts: {},
        entries: inheritedEntries,
        harnesses: null,
        isChainListed: true,
        notes: {},
        onPreset: () => {},
      }),
    );
    expect(markup).toContain("constructor");
    expect(markup).toContain("toString");
    expect(markup).toContain("Opus 5.5");
    expect(markup).not.toContain("unsaved");
  });

  it("distinguishes cards that share a display name by their explicit id when looking up drafts and notes", () => {
    const duplicateNameEntries = [
      { id: "Default", isChosen: true, preset: { ...heavy, name: "Default" } },
      { id: "custom:Default", isChosen: false, preset: { ...heavy, name: "Default" } },
    ];
    const markup = renderToStaticMarkup(
      createElement(PresetChooser, {
        drafts: { "custom:Default": { ...runner("claude-haiku-4-5"), backups: [] } },
        entries: duplicateNameEntries,
        harnesses: null,
        isChainListed: true,
        notes: {},
        onPreset: () => {},
      }),
    );
    expect(markup).toContain("Opus 5.5");
    expect(markup).toContain("Haiku 4.5");
    expect(markup.match(/unsaved/g)).toHaveLength(1);
  });

  it("offers + Add a companion when an add handler is provided", () => {
    expect(chooserMarkup(null, { onAdd: () => {} })).toContain("+ Add a companion");
  });

  it("says a tier is not set in place of its chain", () => {
    const markup = chooserMarkup(null, {
      notes: { Heavy: "Not set: starts on the default Companion" },
    });
    expect(markup).toContain("Not set: starts on the default Companion");
    expect(markup).not.toContain("Opus 5.5");
  });
});

describe("editing a companion not made yet", () => {
  const markup = renderToStaticMarkup(
    createElement(PresetChainEditor, {
      harnesses: null,
      isNew: true,
      name: "New companion",
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

  it("shows disabled controls and Nothing changed yet while unchanged", () => {
    const markup = editorMarkup(null);
    expect(markup).toContain("Nothing changed yet.");
    expect(markup).toContain("FALLBACK ORDER");
    expect(markup).toContain("Primary");
    expect(markup).toContain("Discard");
    expect(markup).toContain("Overwrite “Heavy”");
  });

  it("resumes a kept draft with Overwrite, Save as new and Discard", () => {
    const markup = editorMarkup(edited);
    expect(markup).toContain("You changed this companion.");
    expect(markup).toContain("Overwrite “Heavy”");
    expect(markup).toContain("Save as new");
    expect(markup).toContain("Discard");
  });

  it("shows a kept draft's chain, not the saved one", () => {
    expect(editorMarkup(edited)).not.toContain("Sonnet 5.5");
    expect(editorMarkup(null)).toContain("Sonnet 5.5");
  });
});

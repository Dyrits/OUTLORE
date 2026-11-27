import type { EffortChoice } from "@outlore/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CompanionPanel } from "../../src/editors/companionPicker";
import { PresetEditor } from "../../src/editors/presetEditor";
import { RunnerPickers } from "../../src/editors/runners";

// The picker is drawn with react-native, which loads only on a device or in a browser; react-native-web renders the
// same tree to static markup, and the drawn shapes of the provider marks are nothing this test reads.
vi.mock("react-native", async () => await import("react-native-web"));
vi.mock("react-native-svg", () => ({ default: () => null, Path: () => null }));

const markupOf = (effort: EffortChoice) =>
  renderToStaticMarkup(
    createElement(RunnerPickers, {
      harnesses: null,
      isCompact: true,
      onChange: () => {},
      value: { accountId: null, effort, harness: "claude", model: "claude-haiku-4-5" },
    }),
  );

describe("the compact Companion picker in a composer", () => {
  it("names the effort it runs at, Default included", () => {
    expect(markupOf("high")).toContain("High");
    // Before, a Default effort left the picker with no effort named at all, so the effort seemed missing.
    expect(markupOf("default")).toContain("Default");
  });
});

describe("saving the current Companion stack", () => {
  it("offers Save as a preset even when the library is empty", () => {
    const markup = renderToStaticMarkup(
      createElement(CompanionPanel, {
        accountId: null,
        effort: "default",
        effortOptions: ["default"],
        harness: "claude",
        harnesses: null,
        isAccountShown: true,
        model: "claude-haiku-4-5",
        onEffort: () => {},
        onModel: () => {},
        presetChoice: { backups: [], onPreset: () => {}, onSavePreset: async () => {}, presets: [] },
      }),
    );
    expect(markup).toContain("Save as a preset");
  });
});

describe("the presets of the Companions tab", () => {
  const codex = { accountId: null, effort: "default", harness: "codex", model: "gpt-5" } as const;
  const heavy = {
    backups: [codex],
    name: "Heavy",
    runner: { accountId: null, effort: "default", harness: "claude", model: "claude-opus-5-5" },
  } as const;
  const panel = (backups: ReadonlyArray<typeof codex> | null, model: string, onOverwritePreset = async () => {}) =>
    renderToStaticMarkup(
      createElement(CompanionPanel, {
        accountId: null,
        effort: "default",
        effortOptions: ["default"],
        harness: "claude",
        harnesses: null,
        isAccountShown: true,
        model,
        onEffort: () => {},
        onModel: () => {},
        presetChoice: {
          backups,
          onOverwritePreset,
          onPreset: () => {},
          onSavePreset: async () => {},
          presets: [heavy],
        },
      }),
    );

  it("shows a Custom entry, marked and not saved yet, when the stack matches no preset", () => {
    const markup = panel([codex], "claude-sonnet-5-5");
    expect(markup).toContain("Custom");
    expect(markup).toContain("not saved yet");
    expect(markup).not.toContain(">Edit<");
  });

  it("shows no Custom entry, and offers Edit, when the stack is a preset's", () => {
    const markup = panel([codex], "claude-opus-5-5");
    expect(markup).not.toContain("not saved yet");
    expect(markup).toContain(">Edit<");
  });

  it("shows no Custom entry while the backups are unread", () => {
    expect(panel(null, "claude-sonnet-5-5")).not.toContain("not saved yet");
  });

  it("offers no Edit when the tab cannot save a preset", () => {
    const markup = renderToStaticMarkup(
      createElement(CompanionPanel, {
        accountId: null,
        effort: "default",
        effortOptions: ["default"],
        harness: "claude",
        harnesses: null,
        isAccountShown: true,
        model: "claude-opus-5-5",
        onEffort: () => {},
        onModel: () => {},
        presetChoice: { backups: [codex], onPreset: () => {}, presets: [heavy] },
      }),
    );
    expect(markup).not.toContain(">Edit<");
  });

  it("titles edit mode with the preset's name and a Done button, over the preset's own folds", () => {
    const markup = renderToStaticMarkup(
      createElement(PresetEditor, {
        harnesses: null,
        name: "Heavy",
        onDone: () => {},
        onSave: async () => {},
        stack: { ...heavy.runner, backups: heavy.backups },
      }),
    );
    expect(markup).toContain("Editing Heavy");
    expect(markup).toContain(">Done<");
    expect(markup).toContain("Backup companions");
  });
});

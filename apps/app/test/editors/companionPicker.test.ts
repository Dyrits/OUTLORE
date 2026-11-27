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
  it("offers Save as new even when the library is empty", () => {
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
    expect(markup).toContain("Save as new");
    expect(markup).toContain("+ Add a companion");
  });
});

describe("the companions of the Companions tab", () => {
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

  it("shows no Custom entry and no Presets header when the stack matches no preset", () => {
    const markup = panel([codex], "claude-sonnet-5-5");
    expect(markup).not.toContain(">Custom<");
    expect(markup).not.toContain(">Presets<");
    expect(markup).toContain("Current companion");
    expect(markup).toContain("Sonnet 5.5");
  });

  it("shows the selected companion directly in the unified chain editor with model names", () => {
    const markup = panel([codex], "claude-opus-5-5");
    expect(markup).toContain("Heavy");
    expect(markup).toContain("Opus 5.5");
    expect(markup).toContain("GPT-5");
    expect(markup).toContain("Primary");
    expect(markup).not.toContain("Backup 1");
    expect(markup).not.toContain(">Edit<");
  });

  it("shows the model name rather than Companion while backups are unread", () => {
    const markup = panel(null, "claude-sonnet-5-5");
    expect(markup).toContain("Sonnet 5.5");
    expect(markup).not.toContain(">Companion<");
  });

  it("titles the editor card with the companion's name and shows fallback order", () => {
    const markup = renderToStaticMarkup(
      createElement(PresetEditor, {
        harnesses: null,
        name: "Heavy",
        onSave: async () => {},
        stack: { ...heavy.runner, backups: heavy.backups },
      }),
    );
    expect(markup).toContain("Heavy");
    expect(markup).toContain("FALLBACK ORDER");
    expect(markup).toContain(">Primary<");
    expect(markup).toContain("Opus 5.5");
    expect(markup).toContain("GPT-5");
    expect(markup).toContain("Nothing changed yet.");
  });
});

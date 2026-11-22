import type { EffortChoice } from "@outlore/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
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

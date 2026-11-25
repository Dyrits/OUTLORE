import type { StartingContext } from "@outlore/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StartingContextWarning } from "../../src/conversation/startingContextWarning";

// The warning is drawn with react-native, which loads only on a device or in a browser; react-native-web renders the
// same tree to static markup.
vi.mock("react-native", async () => await import("react-native-web"));
vi.mock("react-native-svg", () => ({ default: () => null, Path: () => null }));

const context = (largerModels: StartingContext["largerModels"]): StartingContext => ({
  isOverWarning: true,
  largerModels,
  parts: {
    budget: 0,
    instructions: 2400,
    journal: 50,
    lore: 20,
    openerMessages: 71_800,
    position: 50,
    request: 0,
    workspace: 580,
  },
  tokens: 75_000,
  warningPercent: 25,
  windowTokens: 200_000,
});

const markupOf = (value: StartingContext) =>
  renderToStaticMarkup(
    createElement(StartingContextWarning, { context: value, onChooseModel: () => {}, onTrim: () => {} }),
  );

describe("the starting-context warning", () => {
  it("says how much of the window the errand would start with, and offers to trim lore", () => {
    const markup = markupOf(context([]));
    expect(markup).toContain("75,000 tokens");
    expect(markup).toContain("the warning is at 25%");
    expect(markup).toContain("Trim lore");
  });

  it("offers each model with a larger window", () => {
    const markup = markupOf(context(["claude-opus-5-5"]));
    expect(markup).toContain("Use ");
    expect(markup).not.toContain("No model has a larger context window.");
  });

  it("says so when no model has a larger window", () => {
    expect(markupOf(context([]))).toContain("No model has a larger context window.");
  });
});

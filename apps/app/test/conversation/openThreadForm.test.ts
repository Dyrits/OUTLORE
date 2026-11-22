import { ThreadView } from "@outlore/contracts";
import { Schema } from "effect";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OpenThreadForm } from "../../src/conversation/threadTree";
import type { Runner } from "../../src/editors/runners";
import type { ServiceClient } from "../../src/foundation/client";

// The form is drawn with react-native, which loads only on a device or in a browser; react-native-web renders the
// same tree to static markup, and the drawn shapes of the provider marks are nothing this test reads.
vi.mock("react-native", async () => await import("react-native-web"));
vi.mock("react-native-svg", () => ({ default: () => null, Path: () => null }));

// The pickers stand in as markers of what they were given, so the layout is checked on its own: which picker sits
// where, and whether the compact one is the selected tab's own.
vi.mock("../../src/editors/runners", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/editors/runners")>();
  return {
    ...actual,
    RunnerPickers: (props: { isFullPanel?: boolean; isTabOpen?: boolean; value: Runner }) =>
      `pickers ${props.isFullPanel === true ? "panel" : `compact ${props.isTabOpen === true ? "selected" : "plain"}`} ${props.value.model}`,
  };
});
// The composer is a boundary of its own, and its own module reaches the device's attachments and dictation; only
// that it stays mounted with its accessory matters here.
vi.mock("../../src/ui/controls", () => ({
  Composer: (props: { accessory?: ReactNode }) => createElement("composer", null, props.accessory),
}));
vi.mock("../../src/lore/lore", () => ({ LoreScreen: () => "lore" }));

const client = {
  request: () => new Promise<never>(() => {}),
  subscribe: () => () => {},
} as unknown as ServiceClient;

const parent = Schema.decodeUnknownSync(ThreadView)({
  accountId: null,
  accountLabel: "Signed in",
  actions: { canOpenBeneath: true, canResume: false, canStop: false, isInTurn: false },
  blocker: null,
  depth: 0,
  effort: "high",
  failure: null,
  harness: "claude",
  id: "th_parent",
  model: "claude-haiku-4-5",
  ownCopy: null,
  parentId: null,
  state: "Resting",
  title: "A quest",
  turnHarness: null,
  turnModel: null,
  waitingCount: 0,
  workspace: null,
});

const markupOf = (isSelected: boolean) =>
  renderToStaticMarkup(
    createElement(OpenThreadForm, {
      client,
      companions: { isSelected, onOpen: () => {} },
      onOpened: () => {},
      parent,
    }),
  );

describe("a new errand's draft in the Companions tab", () => {
  it("carries its own compact picker beside the full panel, selected as a saved errand's pane does", () => {
    const markup = markupOf(true);
    expect(markup).toContain("pickers panel");
    expect(markup).toContain("pickers compact selected claude-haiku-4-5");
    // The composer stays mounted with its own accessory, so the draft's typed text survives the tab switch.
    expect(markup).toContain("<composer");
    expect(markup.match(/pickers compact/g) ?? []).toHaveLength(2);
  });

  it("keeps the composer's single compact picker in the Missives tab", () => {
    const markup = markupOf(false);
    expect(markup).not.toContain("pickers panel");
    expect(markup).toContain("pickers compact plain claude-haiku-4-5");
    expect(markup.match(/pickers compact/g) ?? []).toHaveLength(1);
    expect(markup).toContain("<composer");
  });
});

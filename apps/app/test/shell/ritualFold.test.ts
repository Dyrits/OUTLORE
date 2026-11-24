import { MissionSummary, type RitualCard, type WorkspaceChoice } from "@outlore/contracts";
import { Schema } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ServiceClient } from "../../src/foundation/client";
import { Quest, RitualRow } from "../../src/shell/railQuests";

// The rows are drawn with react-native, which loads only on a device or in a browser; react-native-web renders the
// same tree to static markup, and the drawn shapes of the marks are nothing this test reads.
vi.mock("react-native", async () => await import("react-native-web"));
vi.mock("react-native-svg", () => ({ default: () => null, Path: () => null }));

const usage = { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 };
const mission = (id: string, ritual: RitualCard | null) =>
  Schema.decodeUnknownSync(MissionSummary)({
    budget: { limits: { cost: null, tokens: null }, spent: { cost: 0, tokens: 0 } },
    consumption: { earlierTurns: 0, estimated: 0, reported: 0, tokens: usage, turns: 0, unpricedTurns: 0 },
    harness: "claude",
    id,
    isEmpty: false,
    isTitleByUser: false,
    lastActivityAt: 0,
    lastExchange: { owner: null, reply: null },
    model: "default",
    prompt: null,
    ritual,
    runningCount: 0,
    state: "Resting",
    threadCount: 3,
    title: id,
    topThreadId: "top",
    usage,
    workspaceId: null,
    workspaceName: null,
  });
const ritual = {
  id: "ritual",
  isOn: true,
  lastRunAt: null,
  lastRunState: null,
  nextRunAt: 1000,
  originMissionId: null,
  schedule: { _tag: "Daily", time: "07:00" },
} as unknown as RitualCard;

const rowProps = {
  client: {} as ServiceClient,
  collapsed: new Set<string>(),
  isOpen: false,
  onOpenErrands: () => {},
  onOpenMission: () => {},
  onOpenThread: () => {},
  onToggle: () => {},
  onToggleThread: () => {},
  openMission: null,
  openThread: null,
  shouldShowAgentThreads: true,
};
const realms: ReadonlyArray<WorkspaceChoice> = [];

// The fold chevron of a row with errands beneath it, as the markup draws it: a button named Expand or Collapse.
const chevronOf = (markup: string): string =>
  markup.match(/<[^>]*aria-label="(?:Expand|Collapse) [^"]*"[^>]*>/)?.[0] ?? "";

describe("the fold chevron of a Ritual row (CHG-0635)", () => {
  it("is drawn, and stays in view without hovering, as a quest's is", () => {
    const quest = chevronOf(
      renderToStaticMarkup(createElement(Quest, { ...rowProps, mission: mission("quest", null) })),
    );
    const row = chevronOf(
      renderToStaticMarkup(createElement(RitualRow, { ...rowProps, mission: mission("moon", ritual), realms })),
    );
    expect(quest).toContain('aria-label="Expand quest"');
    expect(quest).not.toContain("opacity:0");
    expect(row).toContain('aria-label="Expand moon"');
    expect(row).not.toContain("opacity:0");
  });
});

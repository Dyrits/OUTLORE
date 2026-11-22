import { type MissionId, Ritual as RitualSchema } from "@outlore/contracts";
import { Schema } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ServiceClient } from "../../src/foundation/client";
import { RitualForm } from "../../src/rituals/ritualForm";
import { RitualFormScreen } from "../../src/rituals/ritualFormScreen";

// The form is drawn with react-native, which loads only on a device or in a browser; react-native-web renders the
// same tree to static markup, and the drawn shapes of the emblems are nothing this test reads.
vi.mock("react-native", async () => await import("react-native-web"));
vi.mock("react-native-svg", () => ({ default: () => null, Path: () => null }));

const client = {
  request: () => new Promise<never>(() => {}),
  subscribe: () => () => {},
} as unknown as ServiceClient;

// A saved Ritual with one fallback, as ReadRitual brings one back.
const ritual = Schema.decodeUnknownSync(RitualSchema)({
  fallbacks: [{ accountId: null, effort: "default", harness: "codex", model: "gpt-6" }],
  id: "rit_1",
  instruction: "Summarise the day.",
  isOn: false,
  isRealmArchived: false,
  lastRunAt: null,
  lastRunState: null,
  missionId: "m_ritual",
  nextRunAt: null,
  originMissionId: null,
  primary: { accountId: null, effort: "high", harness: "claude", model: "claude-sonnet-5-5" },
  schedule: { _tag: "Daily", time: "07:00" },
  scope: [],
  threadId: "t_ritual",
  title: "Morning digest",
});

// Effects never run in static markup, so the service reads stay pending: the fields are what matters.
const count = (markup: string, text: string) => markup.split(text).length - 1;
const screenMarkupOf = (target: Parameters<typeof RitualFormScreen>[0]["target"]) =>
  renderToStaticMarkup(
    createElement(RitualFormScreen, {
      client,
      onClose: () => {},
      onOpened: () => {},
      target,
    }),
  );

describe("the Ritual form as the conversation area's own screen", () => {
  it("draws a new Ritual over the panes it covers, with a Back and named Companion fields", () => {
    const markup = screenMarkupOf({ kind: "create", originMissionId: null, realmPath: null });
    expect(markup).toContain("← Back");
    expect(markup).toContain("New Ritual");
    // The Companion is chosen in the form itself, not in the Companions tab the compact composer's button opens. The
    // name shows once in the field's label and once in the menu's own, so one picker counts twice.
    expect(markup).toContain("Companion (model)");
    expect(count(markup, "Companion (model)")).toBe(2);
  });

  it("derives a new Ritual from the quest it is scheduled from, without choosing a realm folder", () => {
    const markup = screenMarkupOf({
      kind: "create",
      originMissionId: "m_quest" as MissionId,
      realmPath: null,
    });
    expect(markup).toContain("This Ritual takes the realm of the quest it is scheduled from.");
  });

  it("gives every fallback the form's own named fields, too", () => {
    const markup = renderToStaticMarkup(
      createElement(RitualForm, { client, onCancel: () => {}, onDone: () => {}, ritual }),
    );
    expect(markup).toContain("Edit Ritual");
    // One for the primary Companion, one for the saved fallback; each name shows in its field label and its menu
    // label, and the compact composer's button opens no Companions tab anyone can reach from here.
    expect(count(markup, "Companion (model)")).toBe(4);
    expect(markup).toContain("Save");
  });
});

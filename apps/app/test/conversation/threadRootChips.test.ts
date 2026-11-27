import type { MessageId, ThreadRoot } from "@outlore/contracts";
import type { OpenTransport } from "@outlore/controller";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EntryView } from "../../src/conversation/conversationEntries";
import { ServiceClient } from "../../src/foundation/client";

// The pinned first message of a thread is drawn with react-native; react-native-web renders the same tree to static markup.
vi.mock("react-native", async () => await import("react-native-web"));
vi.mock("react-native-svg", () => ({ default: () => null, Path: () => null }));

const noop = () => {};

let fakeClient: ServiceClient;

beforeAll(async () => {
  const openFakeTransport: OpenTransport = (handlers) => {
    queueMicrotask(handlers.onOpen);
    return { close: noop, isOpen: true, send: noop };
  };
  fakeClient = await ServiceClient.connectThrough(openFakeTransport, "fixture-host");
});

afterAll(() => {
  fakeClient.close();
});

const root = (text: string): ThreadRoot => ({
  fromTitle: null,
  harness: null,
  id: "message-1" as MessageId,
  model: null,
  sender: "user",
  sentAt: 0,
  text,
});

const markupOf = (text: string) =>
  renderToStaticMarkup(
    createElement(EntryView, {
      client: fakeClient,
      entry: { _tag: "Root", at: 0, key: "root", replyCount: 1, root: root(text) },
      harness: "claude",
      onOpenMission: noop,
      onSelectThread: noop,
      skills: [{ description: "Diagnose bugs", name: "debug", path: "/skills/debug/SKILL.md" }],
      workspacePath: null,
    }),
  );

describe("the first message a thread hangs from", () => {
  it("draws a skill the owner named as a chip, as the message bubble does", () => {
    const markup = markupOf("It should display properly. $debug .");
    expect(markup).not.toContain("$debug");
    expect(markup).toContain("debug");
  });

  it("leaves a dollar amount as plain text", () => {
    expect(markupOf("It costs $5.50")).toContain("$5.50");
  });
});

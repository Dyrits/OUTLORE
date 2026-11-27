import { type Message, MessageId, ThreadId, type ThreadRoot } from "@outlore/contracts";
import type { OpenTransport } from "@outlore/controller";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AgentReply } from "../../src/conversation/agentReply";
import { EntryView } from "../../src/conversation/conversationEntries";
import type { Entry } from "../../src/conversation/entries";
import { type CommandRunner, Markdown } from "../../src/conversation/markdown";
import { ServiceClient } from "../../src/foundation/client";

// Markdown, AgentReply, and EntryView are drawn with react-native; react-native-web renders the same tree to static markup.
vi.mock("react-native", async () => await import("react-native-web"));
vi.mock("react-native-svg", () => ({
  default: () => null,
  Path: () => null,
  Rect: () => null,
}));

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

const message = (overrides: Partial<Message> = {}): Message => ({
  attachments: [],
  fromMissionId: null,
  fromThreadId: null,
  fromTitle: null,
  harness: "claude",
  id: MessageId.make("message-1"),
  isDelivered: true,
  isQueued: false,
  isResult: false,
  model: "claude-sonnet",
  replyToMessageId: null,
  sender: "agent",
  sentAt: 0,
  sequence: 1,
  text: "```bash\ngit status\n```",
  threadId: ThreadId.make("thread-1"),
  usage: null,
  ...overrides,
});

const entryMarkupOf = (entry: Entry, onRunCommand: CommandRunner | null) =>
  renderToStaticMarkup(
    createElement(EntryView, {
      client: fakeClient,
      entry,
      harness: "claude",
      onOpenMission: noop,
      onRunCommand,
      onSelectThread: noop,
      skills: [],
      workspacePath: null,
    }),
  );

describe("running a command from a message code block", () => {
  it("shows Run command beside Copy code on a fenced shell block when a runner is available", () => {
    const markup = renderToStaticMarkup(
      createElement(Markdown, { onRunCommand: noop, text: "```bash\ngit status\n```" }),
    );
    expect(markup).toContain('aria-label="Run command"');
    expect(markup).toContain('aria-label="Copy code"');
  });

  it("hides Run command on non-shell or untagged code blocks", () => {
    const tsMarkup = renderToStaticMarkup(
      createElement(Markdown, { onRunCommand: noop, text: "```ts\nconst ok = true;\n```" }),
    );
    const plainMarkup = renderToStaticMarkup(
      createElement(Markdown, { onRunCommand: noop, text: "```\ngit status\n```" }),
    );
    expect(tsMarkup).not.toContain('aria-label="Run command"');
    expect(tsMarkup).toContain('aria-label="Copy code"');
    expect(plainMarkup).not.toContain('aria-label="Run command"');
    expect(plainMarkup).toContain('aria-label="Copy code"');
  });

  it("hides Run command when the screen cannot open a terminal", () => {
    const markup = renderToStaticMarkup(createElement(Markdown, { onRunCommand: null, text: "```sh\nls\n```" }));
    expect(markup).not.toContain('aria-label="Run command"');
    expect(markup).toContain('aria-label="Copy code"');
  });

  it("hides Run command while an agent reply is still streaming as a draft", () => {
    const markup = renderToStaticMarkup(
      createElement(AgentReply, {
        harness: "claude",
        isDraft: true,
        label: "Claude",
        onRunCommand: noop,
        text: "```bash\ngit status\n```",
        time: null,
      }),
    );
    expect(markup).not.toContain('aria-label="Run command"');
  });

  it("shows Run command on a completed agent reply", () => {
    const markup = renderToStaticMarkup(
      createElement(AgentReply, {
        harness: "claude",
        isDraft: false,
        label: "Claude",
        onRunCommand: noop,
        text: "```bash\ngit status\n```",
        time: "19:00",
      }),
    );
    expect(markup).toContain('aria-label="Run command"');
  });

  it("forwards onRunCommand through EntryView into messages, pinned thread roots, and Companion frames", () => {
    const agentEntry: Entry = { _tag: "Message", at: 0, fromQuest: null, key: "m1", message: message() };
    const root: ThreadRoot = {
      fromTitle: null,
      harness: "claude",
      id: MessageId.make("message-root"),
      model: "claude-sonnet",
      sender: "agent",
      sentAt: 0,
      text: "```sh\npwd\n```",
    };
    const rootEntry: Entry = { _tag: "Root", at: 0, key: "root", replyCount: 1, root };
    const frameEntry: Entry = {
      _tag: "Message",
      at: 0,
      frameMessages: [{ key: "f1", message: message({ id: MessageId.make("message-2"), isCompanionAnswer: true }) }],
      fromQuest: null,
      key: "m-open",
      message: message({ id: MessageId.make("message-open"), sender: "user", text: "@Claude check" }),
    };

    expect(entryMarkupOf(agentEntry, noop)).toContain('aria-label="Run command"');
    expect(entryMarkupOf(agentEntry, null)).not.toContain('aria-label="Run command"');
    expect(entryMarkupOf(rootEntry, noop)).toContain('aria-label="Run command"');
    expect(entryMarkupOf(rootEntry, null)).not.toContain('aria-label="Run command"');
    expect(entryMarkupOf(frameEntry, noop)).toContain('aria-label="Run command"');
    expect(entryMarkupOf(frameEntry, null)).not.toContain('aria-label="Run command"');
  });
});

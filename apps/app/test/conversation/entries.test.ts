import {
  MessageId,
  type MissionDetail,
  MissionId,
  type Question,
  QuestionId,
  ThreadId,
  type ThreadSummary,
} from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { entriesOf, newestFirstOf, workingLabel } from "../../src/conversation/entries";

import { detailOf } from "../fixtures/conversation";

const summary = (id: string, parentId: string | null, openedAt: number, isAside = false) =>
  ({
    depth: parentId === null ? 0 : 1,
    id,
    isAside,
    isOpenedByAgent: false,
    openedAt,
    parentId,
    state: "Resting",
    title: id,
    waitingCount: 0,
  }) as ThreadSummary;

const message = (id: string, sentAt: number) => ({ id, sender: "user", sentAt, text: id });

const recordedQuestionOf = (id: string, askedAt: number): Question => ({
  answers: null,
  askedAt,
  choices: null,
  details: id,
  device: null,
  id: QuestionId.make(id),
  message: null,
  missionId: MissionId.make("mission"),
  missionTitle: "Mission",
  outcome: "AllowedAutomatically",
  pattern: null,
  permission: null,
  resolvedAt: askedAt,
  source: "Harness",
  summary: `Ran ${id}`,
  threadId: ThreadId.make("top"),
  threadTitle: "Top",
});

it("leaves pending owner messages out of the feed until a turn takes them in", () => {
  const detail = {
    ...detailOf([summary("top", null, 0)], "top"),
    messages: [
      { ...message("queued", 10), isDelivered: false, isQueued: true },
      { ...message("steered", 20), isDelivered: false, isQueued: false },
      { ...message("reply", 30), sender: "agent" },
    ],
    questions: [recordedQuestionOf("action", 25)],
  } as unknown as MissionDetail;
  expect(entriesOf(detail, true).map((entry) => entry.key)).toEqual(["steps:action", "reply"]);
  const delivered = detail.messages.map((item) => (item.id === "steered" ? { ...item, isDelivered: true } : item));
  expect(entriesOf({ ...detail, messages: delivered }, true).map((entry) => entry.key)).toEqual([
    "steered",
    "steps:action",
    "reply",
  ]);
});

describe("the threads opened beneath, in their opener's conversation", () => {
  it("places each thread opened beneath where it was opened, leaving out asides and deeper threads", () => {
    const threads = [
      summary("top", null, 0),
      summary("child", "top", 20),
      summary("aside", "top", 25, true),
      { ...summary("grandchild", "child", 26), depth: 2 },
    ];
    expect(entriesOf(detailOf(threads, "top")).map((entry) => entry.key)).toEqual(["first", "opened:child", "second"]);
  });
  it("shows no opening in a thread with nothing beneath it", () => {
    const threads = [summary("top", null, 0), summary("child", "top", 20)];
    expect(entriesOf(detailOf(threads, "child")).some((entry) => entry._tag === "ThreadOpened")).toBe(false);
  });
});

describe("the message an errand hangs from, pinned at the top of its pane", () => {
  const root = {
    fromTitle: null,
    harness: null,
    id: MessageId.make("anchor"),
    model: null,
    sender: "user",
    sentAt: 5,
    text: "Check the logs",
  } as const;
  const threads = [{ ...summary("child", "top", 20), replyCount: 2 }, summary("top", null, 0)];
  const errand = { ...detailOf(threads, "child"), thread: { id: "child", root } } as unknown as MissionDetail;

  it("stands before everything the thread did, so the inverted feed draws it at the top", () => {
    const entries = entriesOf(errand);
    expect(entries.map((entry) => entry.key)).toEqual(["root:anchor", "first", "second"]);
    expect(entries[0]).toMatchObject({ _tag: "Root", replyCount: 2, root });
    expect(newestFirstOf(entries).at(-1)?._tag).toBe("Root");
  });
  it("falls back on counting the thread's own messages without a summary count", () => {
    const bare = { ...errand, threads: [summary("child", "top", 20)] } as unknown as MissionDetail;
    expect(entriesOf(bare)[0]).toMatchObject({ _tag: "Root", replyCount: 2 });
  });
  it("does not repeat a thread's own first message, pinned as its root, among the replies", () => {
    const own = {
      ...errand,
      thread: { id: "child", root: { ...root, id: MessageId.make("first") } },
    } as unknown as MissionDetail;
    expect(entriesOf(own).map((entry) => entry.key)).toEqual(["root:first", "second"]);
  });
  it("shows nothing extra in a thread without a root", () => {
    expect(entriesOf(detailOf(threads, "child")).some((entry) => entry._tag === "Root")).toBe(false);
  });
});

describe("handovers, in the conversation they changed", () => {
  it("places each handover line between the messages around it", () => {
    const handovers = [{ at: 20, id: "handover-1", text: "Handed over to Codex · default model · default effort" }];
    const entries = entriesOf(detailOf([summary("top", null, 0)], "top", handovers));
    expect(entries.map((entry) => entry.key)).toEqual(["first", "handover-1", "second"]);
  });
});

describe("links from the Guildmaster's conversation, beside its replies", () => {
  const guildmasterDetail = (messages: ReadonlyArray<object>, suggestions: ReadonlyArray<object> = []) =>
    ({
      activities: [],
      budgetEvents: [],
      handovers: [],
      loreChanges: [],
      messages,
      mission: { id: "guildmaster" },
      questions: [],
      suggestions,
      thread: { id: "top" },
      threads: [summary("top", null, 0)],
    }) as unknown as MissionDetail;
  const owner = (sentAt: number) => ({ id: "owner", sender: "user", sentAt, text: "Fix it" });
  const reply = (sentAt: number) => ({ id: "reply", sender: "agent", sentAt, text: "I opened a quest" });
  const opened = (extra: object = {}) => ({
    askedAt: 15,
    id: "opened",
    isFromGuildmaster: true,
    isRitual: false,
    outcome: "MovedToMission",
    resolvedAt: 16,
    targetMissionId: "quest-1",
    targetTitle: "Fix login",
    ...extra,
  });
  const report = (sentAt: number, fromMissionId: string | null = "quest-1") => ({
    fromMissionId,
    fromTitle: "Delete a ritual",
    id: `report-${sentAt}`,
    sender: "thread",
    sentAt,
    text: "Quest failed",
  });
  const shapeOf = (entries: ReturnType<typeof entriesOf>) => entries.map((entry) => entry.key);

  it("stands what the Guildmaster opened as a card just after its confirmation, not before it", () => {
    const entries = entriesOf(guildmasterDetail([owner(10), reply(30)], [opened()]));
    expect(shapeOf(entries)).toEqual(["owner", "reply", "opened"]);
    expect(entries.at(-1)).toMatchObject({
      _tag: "QuestLink",
      label: "Opened quest",
      missionId: "quest-1",
      title: "Fix login",
    });
  });

  it("names a quest it continued and a Ritual it created as such", () => {
    const labelOf = (extra: object) => {
      const last = entriesOf(guildmasterDetail([owner(10), reply(30)], [opened(extra)])).at(-1);
      return last?._tag === "QuestLink" ? last.label : null;
    };
    expect(labelOf({ outcome: "Continued" })).toBe("Continued in quest");
    expect(labelOf({ isRitual: true })).toBe("Created Ritual");
  });

  it("shows the card where it happened until the confirmation is written", () => {
    const entries = entriesOf(guildmasterDetail([owner(10)], [opened()]));
    expect(shapeOf(entries)).toEqual(["owner", "opened"]);
    expect(entries.at(-1)).toMatchObject({ _tag: "QuestLink", label: "Opened quest", missionId: "quest-1" });
  });

  it("leaves an open question where it was asked, and another thread's suggestions where they were made", () => {
    const open = opened({ outcome: null, resolvedAt: null });
    expect(shapeOf(entriesOf(guildmasterDetail([owner(10), reply(30)], [open])))).toEqual(["owner", "opened", "reply"]);
    const ordinary = opened({ isFromGuildmaster: false });
    expect(shapeOf(entriesOf(guildmasterDetail([owner(10), reply(30)], [ordinary])))).toEqual([
      "owner",
      "opened",
      "reply",
    ]);
  });

  it("gives a report from a quest its own button", () => {
    const entries = entriesOf(guildmasterDetail([report(10), reply(30)]));
    expect(shapeOf(entries)).toEqual(["report-10", "reply"]);
    expect(entries[0]).toMatchObject({ fromQuest: "quest-1" });
  });

  it("gives a report a button only when it names a quest of its own", () => {
    const entries = entriesOf(guildmasterDetail([report(10), report(40, null)]));
    expect(entries.map((entry) => (entry._tag === "Message" ? entry.fromQuest : "other"))).toEqual(["quest-1", null]);
  });
});

describe("what hangs from a message, as reply lines", () => {
  const anchoredDetail = (messages: ReadonlyArray<object>, threads: ReadonlyArray<ThreadSummary>) =>
    ({
      activities: [],
      budgetEvents: [],
      handovers: [],
      loreChanges: [],
      messages,
      mission: { id: "mission" },
      questions: [],
      suggestions: [],
      thread: { id: "top" },
      threads,
    }) as unknown as MissionDetail;
  const note = (id: string, sentAt: number, sender: "user" | "agent" | "system" = "user") => ({
    id,
    sender,
    sentAt,
    text: id,
  });
  const anchor = (messageId: string, threadId: string, missionId = "mission") => ({
    messageId: MessageId.make(messageId),
    missionId: MissionId.make(missionId),
    threadId: ThreadId.make(threadId),
    title: `Title of ${threadId}`,
  });
  const shapeOf = (entries: ReturnType<typeof entriesOf>) => entries.map((entry) => entry.key);

  it("hangs an errand the owner replied into under the message replied to, wherever it was opened", () => {
    const detail = anchoredDetail(
      [note("first", 10), note("second", 30)],
      [summary("top", null, 0), summary("child", "top", 35)],
    );
    const entries = entriesOf(detail, false, [anchor("first", "child")]);
    expect(shapeOf(entries)).toEqual(["first", "opened:child", "second"]);
  });

  it("draws an agent-opened errand's card as its reply line, where the card stands, and nowhere else", () => {
    const detail = anchoredDetail(
      [note("first", 10), note("card", 20, "system"), note("second", 30)],
      [summary("top", null, 0), { ...summary("child", "top", 25), isOpenedByAgent: true }],
    );
    const entries = entriesOf(detail, false, [anchor("card", "child")]);
    // The card itself is no message: the reply line stands in its place, between the messages around it.
    expect(shapeOf(entries)).toEqual(["first", "opened:child", "second"]);
  });

  it("stands a quest a Reply started as a card under the message replied to", () => {
    const detail = anchoredDetail([note("first", 10), note("second", 30)], [summary("top", null, 0)]);
    const entries = entriesOf(detail, false, [anchor("second", "quest-9", "quest-9")]);
    expect(shapeOf(entries)).toEqual(["first", "second", "anchored:quest-9"]);
    expect(entries.at(-1)).toMatchObject({
      _tag: "QuestLink",
      label: "Opened a quest",
      missionId: "quest-9",
      title: "Title of quest-9",
    });
  });

  it("keeps a thread opened the old way at its opening place, and leaves foreign anchors to their quest cards", () => {
    const detail = anchoredDetail(
      [note("first", 10), note("second", 30)],
      [summary("top", null, 0), summary("child", "top", 20)],
    );
    expect(shapeOf(entriesOf(detail, false, []))).toEqual(["first", "opened:child", "second"]);
  });
});

describe("a turn's actions, folded as steps while messages stay visible", () => {
  const turn = (messages: ReadonlyArray<object>) =>
    ({
      activities: [],
      budgetEvents: [],
      handovers: [],
      loreChanges: [],
      messages: messages.map((entry, sequence) => ({ sequence, ...entry })),
      questions: [],
      suggestions: [],
      thread: { id: "top" },
      threads: [],
    }) as unknown as MissionDetail;
  const owner = (sentAt: number) => ({ id: `owner-${sentAt}`, sender: "user", sentAt, text: "Go" });
  const agent = (sentAt: number) => ({ id: `agent-${sentAt}`, sender: "agent", sentAt, text: "Step" });

  it("keeps every reply of a finished turn as a normal message", () => {
    const entries = entriesOf(turn([owner(0), agent(4000), agent(16000), agent(20000)]));
    expect(entries.map((entry) => entry.key)).toEqual(["owner-0", "agent-4000", "agent-16000", "agent-20000"]);
    expect(entries.every((entry) => entry._tag === "Message")).toBe(true);
  });

  it("keeps every reply visible while the thread still works", () => {
    const entries = entriesOf(turn([owner(0), agent(4000), agent(9000)]), true);
    expect(entries.map((entry) => entry._tag)).toEqual(["Message", "Message", "Message"]);
  });

  it("folds the actions a turn ran into its steps, keeping a denial visible", () => {
    const question = (id: string, askedAt: number, outcome: string) => ({
      askedAt,
      choices: null,
      id,
      outcome,
      summary: `Ran ${id}`,
    });
    const detail = turn([owner(0), agent(1000), agent(20000)]);
    const entries = entriesOf({
      ...detail,
      questions: [question("a", 2000, "AllowedAutomatically"), question("b", 3000, "Denied")],
    } as unknown as MissionDetail);
    expect(entries.map((entry) => entry.key)).toEqual(["owner-0", "agent-1000", "steps:a", "b", "agent-20000"]);
    expect(entries[2]).toMatchObject({ _tag: "Steps", seconds: 2, steps: [{ _tag: "Action", id: "a" }] });
  });

  it.each(["Answered", "Skipped", "Withdrawn"] as const)(
    "keeps a choice question that ended %s in the conversation, out of the steps (CHG-0535)",
    (outcome) => {
      const detail = turn([owner(0), agent(1000), agent(20000)]);
      const asked: Question = {
        ...recordedQuestionOf("pick", 2000),
        answers: outcome === "Answered" ? [["A"]] : null,
        choices: [{ allowsOther: true, header: "H", multiple: false, options: [], question: "Which?" }],
        outcome,
      };
      const entries = entriesOf({ ...detail, questions: [asked] } satisfies MissionDetail);
      expect(entries.map((entry) => entry.key)).toEqual(["owner-0", "agent-1000", "pick", "agent-20000"]);
      expect(entries[2]).toMatchObject({ _tag: "Question" });
      expect(entries.some((entry) => entry._tag === "Steps")).toBe(false);
    },
  );

  it("leaves an action's line in the steps beside a choice question kept in the conversation", () => {
    const detail = turn([owner(0), agent(20000)]);
    const asked: Question = {
      ...recordedQuestionOf("pick", 3000),
      answers: [["A"]],
      choices: [{ allowsOther: false, header: "", multiple: false, options: [], question: "Which?" }],
      outcome: "Answered",
    };
    const entries = entriesOf({
      ...detail,
      questions: [recordedQuestionOf("push", 2000), asked],
    } satisfies MissionDetail);
    expect(entries.map((entry) => entry.key)).toEqual(["owner-0", "steps:push", "pick", "agent-20000"]);
    expect(entries[1]).toMatchObject({ _tag: "Steps", steps: [{ _tag: "Action", id: "push" }] });
  });

  it("lists the tool calls the harness reported with the actions, in the order they happened", () => {
    const detail = turn([owner(0), agent(20000)]);
    const entries = entriesOf({
      ...detail,
      activities: [
        { at: 1000, detail: "entries.ts", id: "read", summary: "Read a file" },
        { at: 3000, detail: "bun test", id: "test", summary: "Run a command" },
      ],
      questions: [recordedQuestionOf("push", 2000)],
    } satisfies MissionDetail);
    expect(entries[1]).toMatchObject({
      _tag: "Steps",
      steps: [
        { _tag: "Call", id: "call:read" },
        { _tag: "Action", id: "push" },
        { _tag: "Call", id: "call:test" },
      ],
    });
  });

  it("keeps a modified file's counts on its step, with the thread to read its diff from, and no diff text", () => {
    const detail = turn([owner(0), agent(20000)]);
    const entries = entriesOf({
      ...detail,
      activities: [
        { at: 1000, change: { added: 2, removed: 1 }, detail: "/work/a.ts", id: "edit", summary: "Change a file" },
      ],
    } satisfies MissionDetail);
    expect(entries[1]).toMatchObject({
      _tag: "Steps",
      steps: [{ _tag: "Call", activity: { change: { added: 2, removed: 1 } }, id: "call:edit" }],
      threadId: detail.thread.id,
    });
  });

  it("marks the group of a working turn as current while only tool calls fill it", () => {
    const detail = turn([owner(0)]);
    const entries = entriesOf(
      {
        ...detail,
        activities: [{ at: 1000, detail: "", id: "read", summary: "Read a file" }],
      } satisfies MissionDetail,
      true,
    );
    expect(entries[1]).toMatchObject({ _tag: "Steps", isCurrent: true });
  });

  it("does not present a settled approval as current work after a reply", () => {
    const detail = turn([owner(0), agent(1000), agent(4000)]);
    const questions = [
      {
        askedAt: 2000,
        choices: null,
        id: "install",
        outcome: "Allowed",
        summary: "May I install the project dependencies?",
      },
    ];
    const entries = entriesOf({ ...detail, questions } as unknown as MissionDetail, true);
    expect(entries.find((entry) => entry._tag === "Steps")).toMatchObject({ isCurrent: true });
    expect(workingLabel).toBe("Working…");
  });

  it("leaves a lone reply of a finished turn as it is", () => {
    expect(entriesOf(turn([owner(0), agent(4000)])).map((entry) => entry._tag)).toEqual(["Message", "Message"]);
  });

  describe("ordering entries for the inverted feed", () => {
    it("lists the newest entry first", () => {
      const entries = entriesOf(turn([owner(0), agent(4000)]));
      expect(newestFirstOf(entries).map((entry) => entry.key)).toEqual(entries.map((entry) => entry.key).reverse());
    });

    it("leaves the chronological list it was given as it was", () => {
      const entries = entriesOf(turn([owner(0), agent(4000)]));
      const keys = entries.map((entry) => entry.key);
      newestFirstOf(entries);
      expect(entries.map((entry) => entry.key)).toEqual(keys);
    });
  });
});

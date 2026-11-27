import { companionTokenOf, MessageId, type MissionDetail, MissionId, ThreadId } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { targetIndexOf } from "../../src/conversation/chronicleTarget";
import { matchingMessages } from "../../src/conversation/conversationSearch";
import { entriesOf } from "../../src/conversation/entries";
import { sideChatsOf } from "../../src/conversation/sideChats";
import { detailOf } from "../fixtures/conversation";

// A Companion's answer is drawn inside a frame under the owner's message it answers (thread-messaging, Mentioning a Companion with @; CHG-0785, CHG-0786).

const mention = companionTokenOf({ accountId: null, harness: "claude", model: "claude-haiku-5-5" });

type Row = {
  companionFrameContext?: "None" | "Shared" | "Outdated";
  companionFrameId?: string;
  id: string;
  isCompanionAnswer?: boolean;
  model?: string | null;
  replyToMessageId?: string;
  sender: string;
  sentAt: number;
  text: string;
};
const owner = (id: string, sentAt: number, text = id): Row => ({ id, sender: "user", sentAt, text });
const reply = (id: string, sentAt: number): Row => ({ id, sender: "agent", sentAt, text: id });
const answer = (id: string, sentAt: number, to: string): Row => ({
  ...reply(id, sentAt),
  isCompanionAnswer: true,
  replyToMessageId: to,
});

const detailWith = (messages: ReadonlyArray<Row>, root?: string) =>
  ({
    ...detailOf([], "top"),
    messages,
    thread: { id: "top", ...(root === undefined ? {} : { root: { id: root, sender: "user", sentAt: 1, text: root } }) },
  }) as unknown as MissionDetail;

describe("a Companion's answer in its tagged message's frame", () => {
  it("hangs under the tagged message however many messages came between", () => {
    const entries = entriesOf(
      detailWith([
        owner("asked", 10, `${mention} do you know?`),
        reply("main", 20),
        owner("later", 30),
        answer("haiku", 40, "asked"),
        reply("last", 50),
      ]),
    );
    expect(entries.map((entry) => entry.key)).toEqual(["asked", "main", "later", "last"]);
    const asked = entries[0];
    expect(asked).toMatchObject({ _tag: "Message" });
    expect(asked?._tag === "Message" ? asked.answers?.map((item) => item.key) : null).toEqual(["haiku"]);
    expect(asked?._tag === "Message" ? asked.answers?.[0]?.message.sender : null).toBe("agent");
  });

  it("keeps several answers to one message in the order they were written", () => {
    const entries = entriesOf(
      detailWith(
        [owner("asked", 10), answer("slow", 30, "asked"), answer("quick", 20, "asked")].sort(
          (a, b) => a.sentAt - b.sentAt,
        ),
      ),
    );
    expect(entries.map((entry) => entry.key)).toEqual(["asked"]);
    const [asked] = entries;
    expect(asked?._tag === "Message" ? asked.answers?.map((item) => item.key) : null).toEqual(["quick", "slow"]);
  });

  it("stands on its own just after a tagged message that is not drawn, rather than at the end", () => {
    const entries = entriesOf(
      detailWith(
        [
          owner("pinned", 1, `${mention} first words`),
          reply("main", 20),
          owner("later", 30),
          answer("haiku", 40, "pinned"),
        ],
        "pinned",
      ),
    );
    expect(entries.map((entry) => entry.key)).toEqual(["root:pinned", "haiku", "main", "later"]);
    const standalone = entries[1];
    expect(standalone).toMatchObject({ _tag: "Message", replyToText: "first words" });
  });

  it("leaves an answer whose tagged message is unknown where it was written", () => {
    const entries = entriesOf(detailWith([owner("a", 10), answer("haiku", 40, "gone"), owner("b", 50)]));
    expect(entries.map((entry) => entry.key)).toEqual(["a", "haiku", "b"]);
  });

  it("leaves a reply that only anchors to a message, such as an errand's brief, as an entry of its own", () => {
    const entries = entriesOf(
      detailWith([
        owner("asked", 10),
        { ...reply("brief", 40), replyToMessageId: "asked" } satisfies Row,
        owner("b", 50),
      ]),
    );
    expect(entries.map((entry) => entry.key)).toEqual(["asked", "brief", "b"]);
    expect(entries[1]).toMatchObject({ replyToText: "asked" });
    expect(entries[0]).not.toHaveProperty("answers");
  });

  it("carries the reply lines hung from the answer with it", () => {
    const anchors = [
      {
        messageId: MessageId.make("haiku"),
        missionId: MissionId.make("other"),
        threadId: ThreadId.make("t"),
        title: "Follow",
      },
    ];
    const [asked] = entriesOf(detailWith([owner("asked", 10), answer("haiku", 20, "asked")]), false, anchors);
    expect(asked?._tag === "Message" ? asked.answers?.[0]?.replies?.map((item) => item.key) : null).toEqual([
      "anchored:t",
    ]);
  });
});

describe("finding a message inside a frame", () => {
  const entries = entriesOf(
    detailWith([owner("asked", 10, "a question"), reply("main", 20), answer("haiku", 30, "asked"), owner("later", 40)]),
  );

  it("finds a Companion's answer by its words at the entry that carries it", () => {
    expect(matchingMessages(entries, "haiku")).toEqual([{ index: 2, key: "asked" }]);
    expect(matchingMessages(entries, "question")).toEqual([{ index: 2, key: "asked" }]);
  });

  it("opens a Chronicle link to an answer at the frame of its message", () => {
    const target = {
      messageId: MessageId.make("haiku"),
      questionId: null,
      threadId: ThreadId.make("top"),
      waitingAt: null,
    };
    expect(targetIndexOf(entries, target)).toBe(2);
  });
});

describe("in-frame follow-ups and side-chat jump list", () => {
  it("groups owner follow-ups and their answers into the opening message's frame in order", () => {
    const entries = entriesOf(
      detailWith([
        { ...owner("asked", 10, `${mention} first?`), companionFrameContext: "Outdated" },
        reply("main", 20),
        { ...answer("haiku-1", 30, "asked"), companionFrameId: "asked", model: "claude-haiku-5-5" },
        { ...owner("follow", 40, "and next?"), companionFrameId: "asked", replyToMessageId: "asked" },
        { ...answer("haiku-2", 50, "follow"), companionFrameId: "asked", model: "claude-haiku-5-5" },
      ]),
    );
    expect(entries.map((entry) => entry.key)).toEqual(["asked", "main"]);
    const [asked] = entries;
    expect(asked?._tag === "Message" ? asked.answers?.map((item) => item.key) : null).toEqual([
      "haiku-1",
      "follow",
      "haiku-2",
    ]);
    expect(matchingMessages(entries, "and next")).toEqual([{ index: 1, key: "asked" }]);
  });

  it("lists framed side conversations newest first with stripped preview, count, and context state", () => {
    const entries = entriesOf(
      detailWith([
        { ...owner("first", 10, `${mention} first question`), companionFrameContext: "Shared" },
        { ...answer("a1", 20, "first"), companionFrameId: "first", model: "claude-haiku-5-5" },
        owner("plain", 30, "normal message"),
        { ...owner("second", 40, `${mention} second question`), companionFrameContext: "None" },
        { ...answer("a2", 50, "second"), companionFrameId: "second", model: "claude-haiku-5-5" },
      ]),
    );
    expect(sideChatsOf(entries)).toEqual([
      {
        contextState: "None",
        count: 1,
        index: 0,
        key: "second",
        models: ["Haiku 5.5"],
        preview: "second question",
      },
      {
        contextState: "Shared",
        count: 1,
        index: 2,
        key: "first",
        models: ["Haiku 5.5"],
        preview: "first question",
      },
    ]);
    expect(sideChatsOf(entriesOf(detailWith([owner("plain", 10, "no side chats")])))).toEqual([]);
  });
});

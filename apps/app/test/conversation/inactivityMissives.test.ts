import { type Message, MessageId, MissionId, ThreadId } from "@outlore/contracts";
import { expect, it } from "vitest";
import { entriesOf } from "../../src/conversation/entries";
import { detailOf } from "../fixtures/conversation";

const systemMessage = (id: string, sentAt: number, fromMissionId: Message["fromMissionId"]): Message => ({
  attachments: [],
  fromMissionId,
  fromThreadId: null,
  fromTitle: null,
  harness: null,
  id: MessageId.make(id),
  isDelivered: true,
  isQueued: false,
  isResult: false,
  model: null,
  sender: "system",
  sentAt,
  sequence: sentAt,
  text: id,
  threadId: ThreadId.make("channel"),
  usage: null,
});

it("shows Outlore notices with their quest link and hides old internal system cards", () => {
  const questId = MissionId.make("quest");
  const detail = detailOf([], "channel");
  const messages = [systemMessage("internal", 10, null), systemMessage("notice", 30, questId)];
  expect(entriesOf({ ...detail, messages })).toMatchObject([{ _tag: "Message", fromQuest: questId, key: "notice" }]);
});

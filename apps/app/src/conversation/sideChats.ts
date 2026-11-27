import { type CompanionFrameContext, withoutCompanionTokens } from "@outlore/contracts";
import { modelLabelOf } from "../foundation/formatting";
import { type Entry, newestFirstOf } from "./entries";

/** One framed Companion side conversation in the feed, with its index in newest-first order for jumping to it. */
export type SideChatItem = {
  contextState: CompanionFrameContext;
  count: number;
  index: number;
  key: string;
  models: ReadonlyArray<string>;
  preview: string;
};

/** All framed Companion side conversations in the feed, newest first, for the conversation bar's jump list (CHG-0786). */
export const sideChatsOf = (entries: ReadonlyArray<Entry>): ReadonlyArray<SideChatItem> =>
  newestFirstOf(entries).flatMap((entry, index): Array<SideChatItem> => {
    if (entry._tag !== "Message" || entry.answers === undefined || entry.answers.length === 0) return [];
    const answers = entry.answers.filter((item) => item.message.sender === "agent");
    if (answers.length === 0) return [];
    const models = [
      ...new Set(answers.map((item) => (item.message.model ? modelLabelOf(item.message.model) : "Companion"))),
    ];
    const clean = withoutCompanionTokens(entry.message.text).replace(/\s+/g, " ").trim();
    const preview = clean === "" ? "Side conversation" : clean.length > 72 ? `${clean.slice(0, 71)}…` : clean;
    return [
      {
        contextState: entry.message.companionFrameContext ?? "None",
        count: answers.length,
        index,
        key: entry.key,
        models,
        preview,
      },
    ];
  });

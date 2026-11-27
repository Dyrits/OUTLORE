import { EffortChoice, HarnessName, ModelChoice, TierName } from "@outlore/contracts";
import { Schema } from "effect";
import { toolRefusal, toolText } from "../core/index.ts";
import { latestEntryCount, nothingToRecord } from "./journal.ts";
import { definitionOf, optionalText, optionalWhole, text } from "./toolDefinition.ts";

// The thread tools every quest and errand uses (thread tool catalogue, threadTools.ts): opening and messaging threads, the journal, approvals, and the result.

/** The quest and errand tools, by name. */
export const errandToolDefinitions = {
  answer_prompt: definitionOf({
    description: "Used by Claude Code itself to answer permission prompts. Never call it yourself.",
    // Claude Code reads the decision from the text, so an invalid prompt is denied, not an error.
    invalid: toolText(JSON.stringify({ behavior: "deny", message: "Invalid permission prompt." })),
    isUnasked: false,
    schema: Schema.Struct({
      input: Schema.Record(Schema.String, Schema.Unknown),
      tool_name: Schema.String,
      tool_use_id: Schema.optionalKey(Schema.String),
    }),
  }),
  find_missions: definitionOf({
    description:
      "Find other missions that may fit an off-topic request by their titles, briefings, and opening request; a shared ticket key or link ranks above plain words. Returns up to 3, best first, with their ids, states, and briefings; Ritual quests are excluded.",
    invalid: toolRefusal("Invalid arguments: give request."),
    isUnasked: true,
    schema: Schema.Struct({ request: text("The off-topic part of the owner's message.") }),
  }),
  interrupt_thread: definitionOf({
    description:
      "Interrupt a running thread directly beneath you, by its id: its current turn ends and it waits for a message. Use it when its work is no longer needed or must change course; then message it with what to do instead.",
    invalid: toolRefusal("Invalid arguments: give thread."),
    isUnasked: true,
    schema: Schema.Struct({ thread: text("The id of the thread beneath you to interrupt.") }),
  }),
  open_thread: definitionOf({
    description:
      "From a quest, open an errand for one request to work in parallel with you. From an errand, post the request in the quest as an attributed follow-up for the owner to open by Reply. This starts no new errand. It starts with your request, in your working folder, with your harness, account, model, and effort unless you choose others, and reports its result to you as a message. Use it instead of subagents. A harness other than yours (claude for Claude Code, codex, opencode) runs on its own sign-in and default model unless you name one of its models.",
    invalid: toolRefusal("Invalid arguments: give request."),
    isUnasked: true,
    schema: Schema.Struct({
      effort: Schema.optionalKey(
        EffortChoice.annotate({
          description: "How hard the new thread works, low to max; default is the harness's own. Yours when left out.",
        }),
      ),
      harness: Schema.optionalKey(
        HarnessName.annotate({
          description: "The harness the new thread runs on: claude, codex, or opencode. Yours when left out.",
        }),
      ),
      model: Schema.optionalKey(
        ModelChoice.annotate({
          description: "The new thread's model; default is the harness's own. Yours when left out.",
        }),
      ),
      ownCopy: Schema.optionalKey(
        Schema.Boolean.annotate({
          description:
            "True to give the new thread its own copy of your git workspace: Outlore makes a git worktree in .worktrees/ on a new branch from the commit you work on, and the thread and those beneath it work and commit there without asking the owner. It reports its branch for you to merge. Left out, it works in your folder.",
        }),
      ),
      replyToMessageId: optionalText(
        "The id of the message that prompted this errand; absent uses the latest message.",
      ),
      request: text("Everything the new thread needs to know: it sees none of your conversation."),
      title: optionalText("A short title for the new thread, a few words, shown to the owner."),
    }),
  }),
  read_journal: definitionOf({
    description: `Read the mission's journal: the briefing of where the mission stands, its version, and change log entries. Without arguments it gives the ${latestEntryCount} latest entries.`,
    invalid: toolRefusal("Invalid arguments: before and count are whole numbers."),
    isUnasked: true,
    schema: Schema.Struct({
      before: optionalWhole("Only entries numbered below this one, to read older entries."),
      count: Schema.optionalKey(
        Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)).annotate({
          description: `How many entries, ${latestEntryCount} by default.`,
        }),
      ),
      mission: optionalText(
        "The id of another quest whose journal to read: Chronicler reads any; another thread only one the owner mentioned with # in this turn.",
      ),
    }),
  }),
  read_parent_messages: definitionOf({
    description:
      "Read the conversation of the thread that opened you, which is not included in your context beyond the journal. Without query it gives the latest messages, newest first; with query it gives the best matches for those words, each as a short excerpt. Search with several words and likely synonyms, then read around a hit.",
    invalid: toolRefusal("Invalid arguments: before and count are whole numbers, query is text."),
    isUnasked: true,
    schema: Schema.Struct({
      before: optionalWhole("Only messages numbered below this one, to read older ones or the ones around a hit."),
      count: optionalWhole("How many messages, 10 by default, at most 40."),
      query: optionalText(
        "Words to search for, in any order; a message matches when it holds any of them, and holding more of them ranks it higher. Word endings and prefixes match.",
      ),
    }),
  }),
  report_result: definitionOf({
    description:
      "When your work is done, report your result in one message: it posts as your reply in this thread and goes directly to the thread that opened you, with an entry for the mission's journal. You become Fulfilled; a later message continues you.",
    invalid: toolRefusal(
      `Not reported: give result, and journal: an entry for the mission's journal, or exactly "${nothingToRecord}".`,
    ),
    isUnasked: true,
    schema: Schema.Struct({
      includeContext: Schema.optionalKey(
        Schema.Boolean.annotate({
          description:
            "True to also include this thread's prior conversation context in the report sent to your parent; false or omitted sends only the result.",
        }),
      ),
      journal: text(
        `The entry for the mission's journal saying what you did or decided, or exactly "${nothingToRecord}".`,
      ),
      result: text("The result, complete enough to use without your conversation."),
    }),
  }),
  request_approval: definitionOf({
    description:
      "Ask the owner before one action you judge consequential (see your instructions), or before running one exact command outside the sandbox. One call per action. Wait for the answer; do the action only if it is Allowed. Nothing you write, quote, or cite counts as the owner's approval.",
    invalid: toolRefusal("Invalid arguments: give action and command."),
    isUnasked: false,
    schema: Schema.Struct({
      action: text(
        "One plain sentence: what you want to do and why, e.g. 'Push today's 3 commits so the release can start'.",
      ),
      command: text("The exact command, file path, or recipient and text."),
      outsideSandbox: Schema.optionalKey(
        Schema.Boolean.annotate({
          description:
            "True only to ask the owner to run this exact command outside the sandbox; the question names that capability. Left out, an approval keeps the sandbox.",
        }),
      ),
    }),
  }),
  send_thread_message: definitionOf({
    description:
      "Send a message to your parent thread or to a thread directly beneath you, by its id. Any thread may also message Chronicler by its id, to ask it to find the right quest, and Chronicler may message any quest's top thread. During a turn, you may also message the top thread of a quest, or an errand, the owner mentioned with # in a message of that turn, and answer a thread that wrote to you in it. It joins that thread's current turn if it is running, and wakes it if it is idle.",
    invalid: toolRefusal("Invalid arguments: give to and text."),
    isUnasked: true,
    schema: Schema.Struct({
      includeContext: Schema.optionalKey(
        Schema.Boolean.annotate({
          description:
            "True to also include this thread's prior conversation context with the message; false or omitted sends only text.",
        }),
      ),
      text: text("The message, complete enough to act on: the receiving thread sees none of your conversation."),
      to: text("The receiving thread's id."),
    }),
  }),
  set_mission_title: definitionOf({
    description:
      "Name the mission, from its top thread, or the errand that calls it, on its first turn, with a short title of a few words.",
    invalid: toolRefusal("Not named: give a title."),
    isUnasked: true,
    schema: Schema.Struct({ title: text("A short title of a few words.") }),
  }),
  suggest_mission: definitionOf({
    description:
      "Ask the owner where an off-topic message goes: continue in a matching mission, open a new mission, or keep it as an aside beneath you. Wait for the answer, then carry on as if the message had not been sent to you. Chronicler uses it for every request that calls for a quest, with the ids of the quests that fit, or none: the owner chooses Continue in or Open a new quest, and it offers no aside. Chronicler opens no quest without that choice.",
    invalid: toolRefusal("Invalid arguments: give text, title, and missions."),
    isUnasked: true,
    schema: Schema.Struct({
      missions: Schema.optionalKey(
        Schema.Array(Schema.String).annotate({
          description: "The ids of the missions from find_missions that fit, best first, at most 3.",
        }),
      ),
      realm: optionalText("Chronicler only: the realm for a new quest, when the owner chose or named one."),
      text: text("The off-topic part of the owner's message, as written."),
      tier: Schema.optionalKey(
        TierName.annotate({
          description:
            "How demanding the work is, as the owner set their Companions for it: Light (small, well-scoped, checkable), Balanced (ordinary work), Heavy (ambiguous, architectural, or risky). Left out, the default Companion; a tier the owner did not set also falls back to it.",
        }),
      ),
      title: text("A short title of a few words for a new mission or aside."),
    }),
  }),
  update_journal: definitionOf({
    description:
      "Record a change in the mission's journal: an entry when you settle a decision, change direction, or finish a piece of work. Rewrite the briefing only when where the mission stands has changed; every rewrite comes with an entry.",
    invalid: toolRefusal("Invalid arguments: give entry."),
    isUnasked: true,
    schema: Schema.Struct({
      basedOn: optionalWhole("With briefing: the briefing version your rewrite starts from, as read_journal gave it."),
      briefing: optionalText("The whole new briefing of where the mission stands, short enough for its limit."),
      entry: text("One entry for the change log: what was decided, changed, or done."),
    }),
  }),
};

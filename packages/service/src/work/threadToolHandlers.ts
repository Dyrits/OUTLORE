import type { SuggestionOutcome } from "@outlore/contracts";
import { Effect, Match } from "effect";
import { SqlClient } from "effect/sql";
import {
  HarnessFailure,
  type HarnessPrompt,
  type PromptAnswer,
  type ToolAnswer,
  textFieldOf,
  toolRefusal,
  toolText,
} from "../core/index.ts";
import { claudeChoicesOf, claudePromptAnswerOf } from "../harness/index.ts";
import type { ChoiceDecision } from "./approvalContracts.ts";
import type { Approvals } from "./approvals.ts";
import { countChatter } from "./chatter.ts";
import { type CommandRunner, changed, unchanged, type WithFollowUps } from "./commands.ts";
import { actOnMission, readControlHistory, refuseAction } from "./guildmaster.ts";
import { readAppGuideByGuildmaster } from "./guildmasterGuide.ts";
import { isGuildmasterThread } from "./guildmasterPlace.ts";
import { withProvenance } from "./guildmasterProvenance.ts";
import { createRealmByGuildmaster, renameRealmByGuildmaster } from "./guildmasterRealms.ts";
import { createRitualByGuildmaster, refuseRitual } from "./guildmasterRituals.ts";
import { changeSettingByGuildmaster, readSettingsByGuildmaster } from "./guildmasterSettings.ts";
import { journalToolsOf } from "./journalTools.ts";
import { loreToolsOf } from "./loreTools.ts";
import { insertMessage } from "./messaging.ts";
import { mayMessage } from "./reach.ts";
import type { Resolution, Suggested, Suggestions } from "./suggestions.ts";
import type { Threads } from "./threads.ts";
import { type ArgumentsOf, type ToolHandlers, threadTools as toolCatalogue } from "./threadTools.ts";
import { titleToolsOf } from "./titles.ts";
import { isBeneath, openThreadByAgent, refusedOf, reportResult } from "./tree.ts";

/** Why a thread may not call a thread tool now, or null: an unknown or deleting thread, or one the chatter guard paused. */
export const readCallerRefusal = Effect.fnUntraced(function* (threadId: string, name: string) {
  const sql = yield* SqlClient.SqlClient;
  const [caller] = yield* sql<{
    blocker: string | null;
  }>`SELECT blocker FROM threads WHERE id = ${threadId} AND is_deleting = 0`;
  if (caller === undefined) return "Unknown thread.";
  if (caller.blocker === "Chatter" && name !== "send_thread_message" && name !== "report_result")
    return "Paused by the chatter guard. Wait for the owner.";
  return null;
});

/**
 * A thread's ask-the-owner capability for its turn request: the answer `answer_prompt` gives Claude Code,
 * without MCP. A store that cannot answer fails the turn rather than leave the harness waiting.
 */
export const askOwnerFor =
  (approvals: Approvals["Service"], sql: SqlClient.SqlClient, threadId: string) => (prompt: HarnessPrompt) =>
    Effect.gen(function* () {
      const refusal = yield* readCallerRefusal(threadId, "answer_prompt");
      if (refusal !== null) return { isAllowed: false, text: refusal } satisfies PromptAnswer;
      // The folder question is one-time: it never goes through the standing permissions (harness/threadFolder.ts).
      if (prompt.folderCheck !== undefined) {
        const answered = yield* approvals.askAboutFolder(threadId, {
          folder: textFieldOf(prompt.input, "file_path") ?? "",
          pointsTo: prompt.folderCheck.pointsTo,
          startsIn: prompt.folderCheck.startsIn,
          summary: textFieldOf(prompt.input, "description") ?? `${prompt.toolName} asks about its folder`,
        });
        return { isAllowed: answered.isAllowed, text: answered.text } satisfies PromptAnswer;
      }
      if (prompt.choices !== undefined) return promptAnswerOf(yield* approvals.askChoices(threadId, prompt.choices));
      const decision = yield* approvals.answerPrompt(threadId, prompt);
      return {
        isAllowed: decision.isAllowed,
        text: decision.text,
      } satisfies PromptAnswer;
    }).pipe(
      Effect.provideService(SqlClient.SqlClient, sql),
      Effect.orDie,
      Effect.catchDefect((defect) =>
        Effect.fail(
          new HarnessFailure({
            reason: `Outlore could not ask about ${prompt.toolName}: ${defect instanceof Error ? defect.message : String(defect)}`,
          }),
        ),
      ),
    );

/** What a harness is told of the owner's choice: the answers, or why there are none. */
const promptAnswerOf = (chosen: ChoiceDecision): PromptAnswer =>
  Match.valueTags(chosen, {
    Answered: ({ answers }) => ({ answers, isAllowed: true, text: "" }),
    Skipped: ({ text }) => ({ isAllowed: false, text }),
  });

const carryOn = "Carry on as if that message had not been sent to you; do not answer it.";
// Chronicler answers its owner instead: one sentence saying where the request went.
const confirmInstead = "Tell the owner in one sentence where it went; do not repeat the request.";

/** What `suggest_mission` tells the thread for each way the owner resolved its suggestion. */
const resolutionTextOf = (resolution: Resolution) =>
  ({
    Continued: `The owner continued it in mission "${resolution.targetTitle}" (id ${resolution.targetMissionId}). ${carryOn}`,
    KeptAsAside: `The owner kept it as an aside beneath you: thread "${resolution.targetTitle}" (id ${resolution.targetThreadId}). It will message you what is relevant to the mission. ${carryOn}`,
    MovedToMission: `The owner opened it as a new mission "${resolution.targetTitle}" (id ${resolution.targetMissionId}). ${carryOn}`,
    Withdrawn: "Withdrawn: the turn that asked ended before the owner answered.",
  }) satisfies Record<SuggestionOutcome, string>;

/** What `suggest_mission` answers the thread. */
const suggestedAnswerOf = (suggested: Suggested): ToolAnswer =>
  Match.valueTags(suggested, {
    NotAsked: () => toolRefusal("Not asked: this thread is not at work in a turn, so the owner was not asked."),
    OpenedWithoutAsking: ({ resolution }) =>
      toolText(
        `No mission fits, so Outlore opened it as a new mission "${resolution.targetTitle}" (id ${resolution.targetMissionId}), as the owner's settings ask. ${carryOn}`,
      ),
    Resolved: ({ resolution }) =>
      resolution.outcome === "Withdrawn"
        ? toolRefusal(resolutionTextOf(resolution)[resolution.outcome])
        : toolText(resolutionTextOf(resolution)[resolution.outcome]),
    UnknownRealm: ({ given }) =>
      toolRefusal(
        `Not proposed: no realm "${given}" is tied to a folder. Name one of the realms in your context that has a folder, or leave the realm out.`,
      ),
    UnknownThread: () => toolRefusal("Unknown thread."),
  });

/** Answers every thread tool with its decoded arguments, through the modules that own each one and the command runner. */
export const makeToolHandlers = (dependencies: {
  readonly approvals: Approvals["Service"];
  readonly commands: CommandRunner;
  readonly suggestions: Suggestions["Service"];
  readonly threads: Threads["Service"];
}): ToolHandlers => {
  const { approvals, commands, suggestions, threads } = dependencies;
  /**
   * Runs a tool's command. Every thread tool call that reaches the store announces a change, refused or
   * not, as it always has; the operation's other follow-ups apply as it returned them.
   */
  const runTool = <A, E>(operation: Effect.Effect<WithFollowUps<A>, E, SqlClient.SqlClient>) =>
    commands
      .run(Effect.map(operation, (done) => ({ ...done, followUps: { ...done.followUps, isChanged: true } })))
      .pipe(Effect.orDie);
  /** Runs a tool's storage work, which returns no follow-ups of its own. */
  const commit = <A, E>(work: Effect.Effect<A, E, SqlClient.SqlClient>) =>
    runTool(Effect.map(work, (value) => changed(value)));

  const openThread = (threadId: string, { effort, harness, model, request, title }: ArgumentsOf<"open_thread">) =>
    runTool(
      openThreadByAgent(threadId, request, title ?? null, {
        effort: effort ?? null,
        harness: harness ?? null,
        model: model ?? null,
      }).pipe(
        // A refused account comes back to the thread as a refusal.
        Effect.catchTag("ServiceFailure", (failure) => Effect.succeed(refusedOf(failure.message))),
      ),
    ).pipe(
      Effect.map((outcome) =>
        Match.valueTags(outcome, {
          Opened: (opened) => toolText(`Opened thread ${opened.threadId}. Its result will come to you as a message.`),
          Refused: (refused) => toolRefusal(refused.reason),
        }),
      ),
    );

  const handlers: ToolHandlers = {
    ...loreToolsOf(commit),
    ...journalToolsOf(commit),
    ...titleToolsOf(commit),
    act_on_mission: (threadId, args) =>
      withProvenance(approvals, commit, threadId, "act_on_mission", args, (authorize) =>
        runTool(
          authorize(actOnMission(threadId, args)).pipe(
            Effect.catchTag("ServiceFailure", (failure) => Effect.succeed(refuseAction(failure.message))),
          ),
        ).pipe(
          Effect.flatMap((outcome) =>
            Match.valueTags(outcome, {
              Done: ({ text }) => Effect.succeed(toolText(text)),
              Refused: ({ text }) => Effect.succeed(toolRefusal(text)),
              ToStop: ({ ids, text }) =>
                Effect.forEach(ids, (id) => threads.stop(id), { discard: true }).pipe(Effect.as(toolText(text))),
            }),
          ),
        ),
      ),
    answer_prompt: (threadId, { input, tool_name, tool_use_id }) => {
      const choices = claudeChoicesOf(tool_name, input);
      const deciding =
        choices === null
          ? approvals.answerPrompt(threadId, { input, toolName: tool_name }, tool_use_id ?? null)
          : approvals.askChoices(threadId, choices).pipe(Effect.map(promptAnswerOf));
      return deciding.pipe(Effect.map((decision) => toolText(claudePromptAnswerOf(input, decision))));
    },
    change_setting: (threadId, args) =>
      withProvenance(approvals, commit, threadId, "change_setting", args, (authorize) =>
        runTool(authorize(changeSettingByGuildmaster(threadId, args))),
      ),
    create_realm: (threadId, args) =>
      withProvenance(approvals, commit, threadId, "create_realm", args, (authorize) =>
        runTool(authorize(createRealmByGuildmaster(threadId, args))),
      ),
    create_ritual: (threadId, args) =>
      withProvenance(approvals, commit, threadId, "create_ritual", args, (authorize) =>
        runTool(
          authorize(createRitualByGuildmaster(threadId, args)).pipe(
            Effect.catchTag("ServiceFailure", (failure) => Effect.succeed(refuseRitual(failure.message))),
          ),
        ).pipe(
          Effect.map((outcome) =>
            Match.valueTags(outcome, {
              Created: ({ text }) => toolText(text),
              Refused: ({ reason }) => toolRefusal(reason),
            }),
          ),
        ),
      ),
    find_missions: suggestions.findMissions,
    interrupt_thread: Effect.fnUntraced(function* (
      threadId: string,
      { thread: target }: ArgumentsOf<"interrupt_thread">,
    ) {
      if (!(yield* commit(isBeneath(threadId, target))))
        return toolRefusal("Not interrupted: you can only interrupt a thread directly beneath you, by its id.");
      if (!(yield* threads.interrupt(target))) return toolRefusal("Not interrupted: that thread is not running.");
      return toolText("Interrupted.");
    }),
    open_thread: (threadId, args) =>
      commit(isGuildmasterThread(threadId)).pipe(
        Effect.flatMap((isGuildmaster) =>
          isGuildmaster
            ? Effect.succeed(
                toolRefusal(
                  "Not opened: Chronicler opens no threads. Propose a quest, or continue one, with suggest_mission.",
                ),
              )
            : openThread(threadId, args),
        ),
      ),
    read_app_guide: (threadId, args) => runTool(readAppGuideByGuildmaster(threadId, args)),
    read_control_history: (threadId, args) => commit(readControlHistory(threadId, args)),
    read_settings: (threadId) => runTool(readSettingsByGuildmaster(threadId)),
    rename_realm: (threadId, args) =>
      withProvenance(approvals, commit, threadId, "rename_realm", args, (authorize) =>
        runTool(authorize(renameRealmByGuildmaster(threadId, args))),
      ),
    report_result: (threadId, { journal, result }) =>
      journal.trim() === ""
        ? Effect.succeed(toolCatalogue.report_result.invalid)
        : runTool(reportResult(threadId, result, journal)).pipe(
            Effect.map((parentId) =>
              parentId === null
                ? toolText("Reported. You are the mission's top thread: the owner reads your replies.")
                : toolText("Reported to your parent. You are Done once this turn ends."),
            ),
          ),
    request_approval: (threadId, given) =>
      approvals
        .requestApproval(threadId, {
          action: given.action,
          command: given.command,
          outsideSandbox: given.outsideSandbox ?? false,
        })
        .pipe(Effect.map((decision) => (decision.isAllowed ? toolText(decision.text) : toolRefusal(decision.text)))),
    send_thread_message: (threadId, { text, to }) =>
      runTool(
        Effect.gen(function* () {
          // Beyond the tree, the owner's mentions and the messages received in this turn open a way (CHG-0181).
          if (!(yield* mayMessage(threadId, to))) return unchanged(false);
          yield* insertMessage({ fromThreadId: threadId, isQueued: false, isResult: false, text, threadId: to });
          // A pause the message set off ends both turns before the receiver is woken.
          return changed(true, { threadsToWake: [to], turnsToCancel: yield* countChatter(threadId, to) });
        }),
      ).pipe(
        Effect.map((isSent) =>
          isSent
            ? toolText("Sent.")
            : toolRefusal(
                "Not sent: you can only message your parent, a thread directly beneath you, Chronicler, a quest or errand the owner mentioned with @ in this turn, or a thread that wrote to you in this turn, by its id.",
              ),
        ),
      ),
    suggest_mission: (threadId, args) =>
      args.text.trim() === ""
        ? Effect.succeed(toolCatalogue.suggest_mission.invalid)
        : suggestions.suggest(threadId, args).pipe(
            Effect.tap(({ followUps }) => commands.apply(followUps)),
            Effect.flatMap(({ value }) =>
              commit(isGuildmasterThread(threadId)).pipe(
                Effect.map((isGuildmaster) => {
                  const answered = suggestedAnswerOf(value);
                  return isGuildmaster
                    ? { ...answered, text: answered.text.replace(carryOn, confirmInstead) }
                    : answered;
                }),
              ),
            ),
          ),
  };
  return handlers;
};

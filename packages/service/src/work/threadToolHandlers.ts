import { Effect, Match } from "effect";
import type { SqlClient } from "effect/sql";
import { toolRefusal, toolText } from "../core/index.ts";
import { claudeChoicesOf, claudePromptAnswerOf } from "../harness/index.ts";
import type { Approvals } from "./approvals.ts";
import { promptAnswerOf } from "./askOwner.ts";
import { countChatter } from "./chatter.ts";
import type { CommandRunner } from "./commands.ts";
import { changed, unchanged, type WithFollowUps } from "./followUps.ts";
import { actOnMission, readControlHistory, refuseAction } from "./guildmaster.ts";
import { readAppGuideByGuildmaster } from "./guildmasterGuide.ts";
import { isChannelThread, isGuildmasterThread } from "./guildmasterPlace.ts";
import { withProvenance } from "./guildmasterProvenance.ts";
import { createRealmByGuildmaster, renameRealmByGuildmaster } from "./guildmasterRealms.ts";
import { changeSettingByGuildmaster, readSettingsByGuildmaster } from "./guildmasterSettings.ts";
import { journalToolsOf } from "./journalTools.ts";
import { loreToolsOf } from "./loreTools.ts";
import { insertMessage } from "./messaging.ts";
import { withThreadContext } from "./parentEcho.ts";
import { readParentMessages } from "./parentMessages.ts";
import type { PhoneLink } from "./phoneLink.ts";
import { phoneToolsOf } from "./phoneToolHandlers.ts";
import { mayMessage } from "./reach.ts";
import { createRitualByThread, editRitualByThread, refuseRitual } from "./ritualTools.ts";
import { carryOn, confirmInstead, suggestedAnswerOf } from "./suggestedAnswers.ts";
import type { Suggestions } from "./suggestions.ts";
import type { Threads } from "./threads.ts";
import { type ArgumentsOf, type ToolHandlers, threadTools as toolCatalogue } from "./threadTools.ts";
import { titleToolsOf } from "./titles.ts";
import { isBeneath, openThreadByAgent, refusedOf, reportResult } from "./tree.ts";

/** Answers every thread tool with its decoded arguments, through the modules that own each one and the command runner. */
export const makeToolHandlers = (dependencies: {
  readonly approvals: Approvals["Service"];
  readonly commands: CommandRunner;
  readonly phone: PhoneLink["Service"];
  readonly suggestions: Suggestions["Service"];
  readonly threads: Threads["Service"];
}): ToolHandlers => {
  const { approvals, commands, phone, suggestions, threads } = dependencies;
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

  const runRitualTool = (operation: ReturnType<typeof createRitualByThread>) =>
    runTool(
      operation.pipe(Effect.catchTag("ServiceFailure", (failure) => Effect.succeed(refuseRitual(failure.message)))),
    ).pipe(
      Effect.map(
        Match.valueTags({
          Done: ({ text }) => toolText(text),
          Refused: ({ reason }) => toolRefusal(reason),
        }),
      ),
    );

  const openThread = (
    threadId: string,
    { effort, harness, model, ownCopy, replyToMessageId, request, title }: ArgumentsOf<"open_thread">,
  ) =>
    runTool(
      openThreadByAgent(
        threadId,
        request,
        title ?? null,
        { effort: effort ?? null, harness: harness ?? null, model: model ?? null },
        ownCopy === true,
        replyToMessageId ?? null,
      ).pipe(
        // A refused account, or an own copy git refused, comes back to the thread as a refusal.
        Effect.catchTag("ServiceFailure", (failure) => Effect.succeed(refusedOf(failure.message))),
      ),
    ).pipe(
      Effect.map((outcome) =>
        Match.valueTags(outcome, {
          FollowUp: () => toolText("Posted your follow-up in the quest. The owner can Reply to open an errand."),
          Opened: (opened) => toolText(`Opened thread ${opened.threadId}. Its result will come to you as a message.`),
          Refused: (refused) => toolRefusal(refused.reason),
        }),
      ),
    );

  const handlers: ToolHandlers = {
    ...loreToolsOf(commit),
    ...journalToolsOf(commit),
    ...titleToolsOf(commit),
    ...phoneToolsOf(phone),
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
        runRitualTool(authorize(createRitualByThread(threadId, args))),
      ),
    edit_ritual: (threadId, args) =>
      withProvenance(approvals, commit, threadId, "edit_ritual", args, (authorize) =>
        runRitualTool(authorize(editRitualByThread(threadId, args))),
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
    read_parent_messages: (threadId, args) => commit(readParentMessages(threadId, args)),
    read_settings: (threadId) => runTool(readSettingsByGuildmaster(threadId)),
    rename_realm: (threadId, args) =>
      withProvenance(approvals, commit, threadId, "rename_realm", args, (authorize) =>
        runTool(authorize(renameRealmByGuildmaster(threadId, args))),
      ),
    report_result: (threadId, { includeContext, journal, result }) =>
      journal.trim() === ""
        ? Effect.succeed(toolCatalogue.report_result.invalid)
        : runTool(reportResult(threadId, result, journal, includeContext === true)).pipe(
            Effect.map((parentId) =>
              parentId === null
                ? toolText("Reported. You are the mission's top thread: the owner reads your replies.")
                : toolText(
                    "Reported to your parent and posted as your reply here. You are Done once this turn ends — end your turn without repeating the result.",
                  ),
            ),
          ),
    request_approval: (threadId, given) =>
      approvals
        .requestApproval(threadId, {
          action: given.action,
          command: given.command,
          isOutsideSandbox: given.outsideSandbox ?? false,
        })
        .pipe(Effect.map((decision) => (decision.isAllowed ? toolText(decision.text) : toolRefusal(decision.text)))),
    send_thread_message: (threadId, { includeContext, text, to }) =>
      runTool(
        Effect.gen(function* () {
          // Beyond the tree, the owner's mentions and the messages received in this turn open a way (CHG-0181).
          if (!(yield* mayMessage(threadId, to))) return unchanged(false);
          const sentText = yield* withThreadContext(threadId, text, includeContext === true);
          const { threadsToWake } = yield* insertMessage({
            fromThreadId: threadId,
            isQueued: false,
            isResult: false,
            text: sentText,
            threadId: to,
          });
          // A pause the message set off ends both turns before the receiver is woken.
          return changed(true, { threadsToWake, turnsToCancel: yield* countChatter(threadId, to) });
        }),
      ).pipe(
        Effect.map((isSent) =>
          isSent
            ? toolText("Sent.")
            : toolRefusal(
                "Not sent: you can only message your parent, a thread directly beneath you, Chronicler, a quest or errand the owner mentioned with # in this turn, or a thread that wrote to you in this turn, by its id.",
              ),
        ),
      ),
    suggest_mission: (threadId, args) =>
      args.text.trim() === ""
        ? Effect.succeed(toolCatalogue.suggest_mission.invalid)
        : suggestions.suggest(threadId, args).pipe(
            Effect.tap(({ followUps }) => commands.apply(followUps)),
            Effect.flatMap(({ value }) =>
              commit(
                Effect.all({
                  isChannel: isChannelThread(threadId),
                  isGuildmaster: isGuildmasterThread(threadId),
                }),
              ).pipe(
                Effect.map(({ isChannel, isGuildmaster }) => {
                  if (isChannel && value._tag === "OpenedWithoutAsking") {
                    return toolText(
                      `Opened quest "${value.resolution.targetTitle}" (id ${value.resolution.targetMissionId}) directly as replies under the owner's message. End your turn without posting another message in the channel.`,
                    );
                  }
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

import { Effect } from "effect";
import type { Connectors } from "../connectors/index.ts";
import { invalid, readStartChoices } from "../core/index.ts";
import { readFileDiff } from "./activities.ts";
import { admitOwnerText, admitRunnerChange, runnerOfOpened, runnerOfStarted } from "./admission.ts";
import { setThreadBackups } from "./backups.ts";
import { markThreadRead, readChronicle } from "./chronicle.ts";
import { listMissions } from "./dashboard.ts";
import { deleteThread, previewDeletion } from "./deleting.ts";
import { dismissPrompt, endMission, previewEnding, reopenMission } from "./ending.ts";
import { changed } from "./followUps.ts";
import { readGuildHallRecap, visitGuildHall } from "./guildHall.ts";
import { readGuildmaster } from "./guildmasterPlace.ts";
import { archiveThread, markThreadDone, reopenThread, restoreThread } from "./lifecycle.ts";
import { readMission, readThreadTree } from "./missionDetail.ts";
import { insertMission, insertQuest } from "./missions.ts";
import { moveQuest } from "./questMoves.ts";
import { placeQuestOrigin } from "./questOrigins.ts";
import { readThreadAnchors, replyToMessage } from "./replies.ts";
import type { HandlerDependencies, OwnerHandlers } from "./requestContext.ts";
import { readStartingContext } from "./startingContext.ts";
import { readThreadPanel } from "./threadPanel.ts";
import { setThreadPermissionMode } from "./threadPermissionMode.ts";
import { newQuestTitle, renameMission } from "./titles.ts";
import { openThreadByOwner } from "./tree.ts";
/** Requests for quests share the service request context. */
export const questsHandlers = (
  { commands, change, threads }: Pick<HandlerDependencies, "commands" | "change" | "threads">,
  connectors: Connectors["Service"],
) =>
  ({
    ArchiveThread: (given) => commands.run(archiveThread(given.threadId)),
    ChangeThreadRunner: (given) => commands.run(admitRunnerChange(given)),
    DeleteThread: (given) => deleteThread(given.threadId, given.confirmation),
    DismissMissionPrompt: (given) => commands.run(dismissPrompt(given.missionId, given.prompt)),
    EndMission: (given) => commands.run(endMission(given.missionId, given.ending, given.snapshot)),
    InterruptThread: (given) =>
      threads
        .interrupt(given.threadId)
        .pipe(
          Effect.flatMap((isInterrupted) =>
            isInterrupted ? Effect.succeed(null) : invalid("This thread is not running."),
          ),
        ),
    ListMissions: (filters) => listMissions(filters),
    MarkThreadDone: (given) => commands.run(markThreadDone(given.threadId)),
    MarkThreadRead: (given) => commands.run(markThreadRead(given.threadId)),
    MoveQuest: (move) => commands.run(moveQuest(move.missionId, move.realmId)),
    OpenThread: (open) =>
      Effect.gen(function* () {
        const attachmentIds = open.attachmentIds ?? [];
        const text = yield* admitOwnerText(
          open.text,
          attachmentIds,
          runnerOfOpened(open.parentThreadId, {
            accountId: open.accountId,
            harness: open.harness,
            model: open.model,
          }),
        );
        return yield* commands.run(
          commands.once(
            open.requestId,
            open._tag,
            openThreadByOwner(
              open.parentThreadId,
              text,
              { accountId: open.accountId, effort: open.effort, harness: open.harness, model: open.model },
              open.shouldStartAnyway,
              attachmentIds,
              open.backups ?? null,
            ),
          ),
        );
      }),
    PreviewDeletion: (given) => previewDeletion(given.threadId),
    PreviewEnding: (given) => previewEnding(given.missionId, given.ending),
    PreviewStartingContext: (given) =>
      readStartingContext(given.parentThreadId, { harness: given.harness ?? null, model: given.model }, given.text),
    ReadChronicle: () => readChronicle,
    ReadFileDiff: (read) => readFileDiff(read.threadId, read.activityId),
    ReadGuildHallRecap: (read) => readGuildHallRecap(read.since),
    ReadGuildmaster: ({ channelId }) => commands.run(readGuildmaster(channelId)),
    ReadMission: (read) => readMission(read.missionId, read.threadId),
    ReadThreadAnchors: (read) => readThreadAnchors(read.threadId),
    ReadThreadPanel: (read) => readThreadPanel(read.threadId, connectors),
    ReadThreadTree: (read) => readThreadTree(read.missionId),
    RenameMission: (rename) => change(renameMission(rename.missionId, rename.title)),
    ReopenMission: (reopen) => commands.run(reopenMission(reopen.missionId)),
    ReopenThread: (given) => commands.run(reopenThread(given.threadId)),
    ReplyToMessage: (reply) =>
      Effect.gen(function* () {
        const text = yield* admitOwnerText(reply.text, [], Effect.succeed(null));
        return yield* commands.run(
          commands.once(
            reply.requestId,
            reply._tag,
            replyToMessage({
              choice: { accountId: reply.accountId, effort: reply.effort, harness: reply.harness, model: reply.model },
              messageId: reply.messageId,
              realmPath: reply.realmPath ?? null,
              text,
            }),
          ),
        );
      }),
    RestoreThread: (given) => commands.run(restoreThread(given.threadId)),
    ResumeThread: (resume) => threads.resume(resume.threadId).pipe(Effect.as(null)),
    RetryThread: (retry) => threads.retry(retry.threadId).pipe(Effect.as(null)),
    SetThreadBackups: (given) => commands.run(setThreadBackups(given.threadId, given.backups)),
    SetThreadPermissionMode: (given) => commands.run(setThreadPermissionMode(given.threadId, given.mode)),
    StartEmptyQuest: (start) =>
      commands.run(
        commands.once(
          start.requestId,
          start._tag,
          Effect.gen(function* () {
            const choices = yield* readStartChoices;
            const started = yield* insertQuest(
              {
                firstMessage: null,
                realm: null,
                realmId: start.realmId,
                shouldInheritRealmPermissions: true,
                shouldRememberChoices: false,
                title: newQuestTitle,
              },
              {
                accountId: choices.accountId,
                effort: choices.effort,
                harness: choices.harness,
                model: choices.model,
              },
              null,
            );
            return changed({ missionId: started.missionId, threadId: started.threadId });
          }),
        ),
      ),
    StartMission: (start) =>
      Effect.gen(function* () {
        const attachmentIds = start.attachmentIds ?? [];
        const text = yield* admitOwnerText(
          start.text,
          attachmentIds,
          runnerOfStarted({ accountId: start.accountId, harness: start.harness, model: start.model }),
        );
        return yield* commands.run(
          commands.once(
            start.requestId,
            start._tag,
            insertMission(
              text,
              { accountId: start.accountId, effort: start.effort, harness: start.harness, model: start.model },
              start.workspacePath,
              true,
              start.realm ?? null,
              attachmentIds,
            ).pipe(
              Effect.tap((started) => placeQuestOrigin(started.threadId, text)),
              Effect.map(({ threadsToWake, ...started }) => changed(started, { threadsToWake })),
            ),
          ),
        );
      }),
    StopThread: (stop) => threads.stop(stop.threadId).pipe(Effect.as(null)),
    VisitGuildHall: () => commands.run(visitGuildHall),
  }) satisfies OwnerHandlers<
    | "ChangeThreadRunner"
    | "DeleteThread"
    | "DismissMissionPrompt"
    | "EndMission"
    | "InterruptThread"
    | "ListMissions"
    | "MarkThreadDone"
    | "MarkThreadRead"
    | "ReopenThread"
    | "ArchiveThread"
    | "RestoreThread"
    | "MoveQuest"
    | "OpenThread"
    | "PreviewDeletion"
    | "PreviewEnding"
    | "PreviewStartingContext"
    | "ReadFileDiff"
    | "ReadGuildHallRecap"
    | "ReadGuildmaster"
    | "ReadChronicle"
    | "ReadMission"
    | "ReadThreadAnchors"
    | "ReadThreadPanel"
    | "ReadThreadTree"
    | "RenameMission"
    | "ReopenMission"
    | "ReplyToMessage"
    | "ResumeThread"
    | "RetryThread"
    | "SetThreadBackups"
    | "SetThreadPermissionMode"
    | "StartEmptyQuest"
    | "StartMission"
    | "StopThread"
    | "VisitGuildHall"
  >;

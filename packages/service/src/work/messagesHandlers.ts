import { Effect } from "effect";
import { readDictationStatus, transcribeDictation } from "../voice/index.ts";
import { admitOwnerText, nonBlank, runnerOfThread } from "./admission.ts";
import { addAttachment, discardAttachment, readAttachment } from "./attachments.ts";
import { insertOwnerMessage } from "./companionAsking.ts";
import { changed } from "./followUps.ts";
import { readViewingLine } from "./guildmasterContext.ts";
import { type BriefingRewrite, ownerOutcomeOf, readJournalView, updateJournal } from "./journal.ts";
import { echoUserMessageToParent } from "./parentEcho.ts";
import { releaseQueued, requeueSteered } from "./pendingMessages.ts";
import { copyOpeningToParent, isUnwritten } from "./questOrigins.ts";
import { editQueuedMessage, removeQueuedMessage } from "./queuedMessages.ts";
import type { HandlerDependencies, OwnerHandlers } from "./requestContext.ts";
/** Requests for writing and reading messages, dictation included, share the service request context. */
export const messagesHandlers = ({ commands }: Pick<HandlerDependencies, "commands">) => {
  /** Writes the owner's journal entry once per request, and shows the owner the journal as it stands. */
  const writeOwnerJournal = (
    request: {
      readonly _tag: Parameters<typeof commands.once>[1];
      readonly requestId: string;
      readonly missionId: string;
    },
    entry: string,
    rewrite: BriefingRewrite | null,
  ) =>
    commands.run(
      commands.once(
        request.requestId,
        request._tag,
        updateJournal(request.missionId, { kind: "user" }, entry, rewrite).pipe(
          Effect.flatMap((outcome) => ownerOutcomeOf(request.missionId, outcome)),
          Effect.map((view) => changed(view)),
        ),
      ),
    );

  return {
    AddAttachment: (add) => addAttachment(add.name, add.data),
    AddJournalEntry: (add) => nonBlank(add.text).pipe(Effect.andThen((text) => writeOwnerJournal(add, text, null))),
    DiscardAttachment: (given) => discardAttachment(given.attachmentId).pipe(Effect.as(null)),
    EditQueuedMessage: (given) =>
      commands.run(editQueuedMessage(given.messageId, given.text).pipe(Effect.as(changed(null)))),
    ReadAttachment: (read) => readAttachment(read.attachmentId),
    ReadDictation: () => readDictationStatus,
    ReadJournal: (read) => readJournalView(read.missionId),
    RemoveQueuedMessage: (given) => commands.run(removeQueuedMessage(given.messageId).pipe(Effect.as(changed(null)))),
    RewriteBriefing: (rewrite) => {
      const entry = rewrite.entry === null || rewrite.entry.trim() === "" ? "Rewrote the briefing" : rewrite.entry;
      return writeOwnerJournal(rewrite, entry, { basedOn: rewrite.basedOn, briefing: rewrite.briefing });
    },
    SendMessage: Effect.fnUntraced(function* (send) {
      const attachmentIds = send.attachmentIds ?? [];
      const text = yield* admitOwnerText(send.text, attachmentIds, runnerOfThread(send.threadId));
      const delivery = send.delivery ?? "Queue";
      const viewing = yield* readViewingLine(send.threadId, send.viewing);
      return yield* commands.run(
        commands.once(
          send.requestId,
          send._tag,
          // The first message of a quest a New quest opened empty is left in its channel, where it becomes the anchor.
          Effect.andThen(
            isUnwritten(send.threadId).pipe(
              Effect.flatMap((isFirst) => (isFirst ? copyOpeningToParent(send.threadId, text) : Effect.void)),
            ),
            insertOwnerMessage({
              attachmentIds,
              isQueued: delivery === "Queue",
              realmPath: send.realmPath ?? null,
              sentToParent: send.sendToParent ?? null,
              text,
              threadId: send.threadId,
              viewing,
            }),
          ).pipe(
            Effect.flatMap(({ value, threadsToWake }) =>
              send.sendToParent === undefined
                ? Effect.succeed(changed(value, { threadsToWake }))
                : echoUserMessageToParent(send.threadId, text, send.sendToParent, value.messageId).pipe(
                    Effect.map((parentWake) =>
                      changed(value, { threadsToWake: [...new Set([...threadsToWake, ...parentWake])] }),
                    ),
                  ),
            ),
          ),
        ),
      );
    }),
    SteerQueuedMessage: (given) =>
      commands.run(
        releaseQueued(given.messageId).pipe(Effect.map((threadId) => changed(null, { threadsToWake: [threadId] }))),
      ),
    TranscribeDictation: (given) => transcribeDictation(given.data),
    UnsteerQueuedMessage: (given) => commands.run(requeueSteered(given.messageId).pipe(Effect.as(changed(null)))),
  } satisfies OwnerHandlers<
    | "AddAttachment"
    | "AddJournalEntry"
    | "DiscardAttachment"
    | "EditQueuedMessage"
    | "ReadAttachment"
    | "ReadDictation"
    | "ReadJournal"
    | "RemoveQueuedMessage"
    | "RewriteBriefing"
    | "SendMessage"
    | "SteerQueuedMessage"
    | "TranscribeDictation"
    | "UnsteerQueuedMessage"
  >;
};

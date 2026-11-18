import { Effect } from "effect";
import { readSettings } from "../core/index.ts";
import { readDictationStatus, transcribeDictation } from "../voice/index.ts";
import { admitOwnerText, nonBlank, runnerOfThread } from "./admission.ts";
import { addAttachment, discardAttachment, readAttachment } from "./attachments.ts";
import { changed } from "./commands.ts";
import { readViewingLine } from "./guildmasterContext.ts";
import { type BriefingRewrite, ownerOutcomeOf, readJournalView, updateJournal } from "./journal.ts";
import { insertUserMessage, releaseQueued } from "./messaging.ts";
import type { HandlerDependencies, OwnerHandlers } from "./requestContext.ts";
import { nameNewQuest } from "./titles.ts";
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
    ReadAttachment: (read) => readAttachment(read.attachmentId),
    ReadDictation: () => readDictationStatus,
    ReadJournal: (read) => readJournalView(read.missionId),
    RewriteBriefing: (rewrite) => {
      const entry = rewrite.entry === null || rewrite.entry.trim() === "" ? "Rewrote the briefing" : rewrite.entry;
      return writeOwnerJournal(rewrite, entry, { basedOn: rewrite.basedOn, briefing: rewrite.briefing });
    },
    SendMessage: Effect.fnUntraced(function* (send) {
      const attachmentIds = send.attachmentIds ?? [];
      const text = yield* admitOwnerText(send.text, attachmentIds, runnerOfThread(send.threadId));
      const delivery = send.delivery ?? (yield* readSettings).defaultDelivery;
      const viewing = yield* readViewingLine(send.threadId, send.viewing);
      return yield* commands.run(
        commands.once(
          send.requestId,
          send._tag,
          insertUserMessage(
            send.threadId,
            text,
            delivery === "Queue",
            attachmentIds,
            send.realmPath ?? null,
            viewing,
          ).pipe(
            Effect.tap(() => nameNewQuest(send.threadId, text)),
            Effect.map((sent) => changed(sent, { threadsToWake: [send.threadId] })),
          ),
        ),
      );
    }),
    SteerQueuedMessage: (given) =>
      commands.run(
        releaseQueued(given.messageId).pipe(Effect.map((threadId) => changed(null, { threadsToWake: [threadId] }))),
      ),
    TranscribeDictation: (given) => transcribeDictation(given.data),
  } satisfies OwnerHandlers<
    | "AddAttachment"
    | "AddJournalEntry"
    | "DiscardAttachment"
    | "ReadAttachment"
    | "ReadDictation"
    | "ReadJournal"
    | "RewriteBriefing"
    | "SendMessage"
    | "SteerQueuedMessage"
    | "TranscribeDictation"
  >;
};

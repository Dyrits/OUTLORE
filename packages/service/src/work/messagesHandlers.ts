import { Effect } from "effect";
import { readSettings } from "../core/index.ts";
import { admitOwnerText, nonBlank, runnerOfThread } from "./admission.ts";
import { addAttachment, discardAttachment, readAttachment } from "./attachments.ts";
import { changed } from "./commands.ts";
import { readViewingLine } from "./guildmaster.ts";
import { ownerOutcomeOf, readJournalView, updateJournal } from "./journal.ts";
import { insertUserMessage } from "./messaging.ts";
import type { HandlerDependencies, OwnerHandlers } from "./requestContext.ts";
import { nameNewQuest } from "./titles.ts";
/** Requests for messages share the service request context. */
export const messagesHandlers = ({ commands }: Pick<HandlerDependencies, "commands">) =>
  ({
    AddAttachment: (add) => addAttachment(add.name, add.data),
    AddJournalEntry: (add) =>
      nonBlank(add.text).pipe(
        Effect.andThen((text) =>
          commands.run(
            commands.once(
              add.requestId,
              add._tag,
              updateJournal(add.missionId, { kind: "user" }, text, null).pipe(
                Effect.flatMap((outcome) => ownerOutcomeOf(add.missionId, outcome)),
                Effect.map((view) => changed(view)),
              ),
            ),
          ),
        ),
      ),
    DiscardAttachment: (given) => discardAttachment(given.attachmentId).pipe(Effect.as(null)),
    ReadAttachment: (read) => readAttachment(read.attachmentId),
    ReadJournal: (read) => readJournalView(read.missionId),
    RewriteBriefing: (rewrite) => {
      const entry = rewrite.entry === null || rewrite.entry.trim() === "" ? "Rewrote the briefing" : rewrite.entry;
      return commands.run(
        commands.once(
          rewrite.requestId,
          rewrite._tag,
          updateJournal(rewrite.missionId, { kind: "user" }, entry, {
            basedOn: rewrite.basedOn,
            briefing: rewrite.briefing,
          }).pipe(
            Effect.flatMap((outcome) => ownerOutcomeOf(rewrite.missionId, outcome)),
            Effect.map((view) => changed(view)),
          ),
        ),
      );
    },
    SendMessage: (send) =>
      Effect.gen(function* () {
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
  }) satisfies OwnerHandlers<
    | "AddAttachment"
    | "AddJournalEntry"
    | "DiscardAttachment"
    | "ReadAttachment"
    | "ReadJournal"
    | "RewriteBriefing"
    | "SendMessage"
  >;

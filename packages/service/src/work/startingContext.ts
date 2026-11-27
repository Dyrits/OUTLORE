import { join } from "node:path";
import type { HarnessName } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { notFound, tokensOf } from "../core/index.ts";
import {
  companionInstructionsOf,
  guildmasterInstructionsOf,
  positionLineOf,
  type ThreadPosition,
  threadInstructionsOf,
} from "../harness/index.ts";
import { loreContextOf, loreInstructions } from "../lore/index.ts";
import { accountOfThread, budgetLineOf } from "./budgetScopes.ts";
import { readGuildmasterContext } from "./guildmasterContext.ts";
import { journalContextOf, journalInstructions } from "./journal.ts";
import { openerContextOf } from "./openerContext.ts";
import { readOwnCopy } from "./ownCopies.ts";
import { isQuestKindOf } from "./questVisibility.ts";
import { namingLineOf } from "./titles.ts";
import { prepareWorkingFolder, readThreadWorkspace, ScratchRoot } from "./workspaces.ts";

// A thread's starting context (thread-tree, Opening a thread): the system part, the same every turn, and the note each turn's message carries.
// A thread's turns and the warning before a thread opens read the same parts.

/** What one turn of a thread starts from: its system part, its note, and where it works. */
export type TurnContext = {
  /** The system part: the working folder and the instructions every thread receives, without titles. */
  readonly context: string;
  readonly cwd: string;
  readonly isInWorkspace: boolean;
  /** What changes turn to turn: the titles, the journal, the opener's messages, lore, and the budget line. */
  readonly note: string;
};

/** A starting context by part, each the text the harness receives. */
export type Sections = {
  readonly budget: string | null;
  readonly instructions: string;
  readonly journal: string;
  readonly lore: string;
  readonly openerMessages: string | null;
  readonly position: string;
  readonly workspace: string;
};

/** Whom a starting context is for: a thread, or one about to be opened. */
export type Subject = {
  /** Whether it is a realm or Borderlands channel conversation. */
  readonly isChannel: boolean;
  /** Whether it is a Companion answering a mention, which starts from the owner's words and the conversation, not a journal. */
  readonly isCompanion: boolean;
  /** Whether it is Chronicler's thread, which starts from the realms and the quest list, not a journal. */
  readonly isGuildmaster: boolean;
  /** Whether the owner explicitly named the mission, which keeps the naming nudge off even if they chose "Quest". */
  readonly isTitleByUser: boolean;
  /** The thread whose scope the lore comes from: the thread itself, or the opener of one about to be opened. */
  readonly loreThreadId: string;
  readonly missionId: string;
  readonly openerMessages: string | null;
  /** Its opener's latest messages, for a thread's first turn only; null otherwise. */
  readonly openerTail: string | null;
  readonly position: ThreadPosition;
};

/** The tokens of a part that may be absent: none when it is. */
export const tokensOfPart = (part: string | null) => (part === null ? 0 : tokensOf(part));

/** Reads every text section of a thread's starting context. */
export const readSections = Effect.fnUntraced(function* (subject: Subject, workspace: string) {
  return {
    budget: yield* budgetLineOf(subject.missionId, yield* accountOfThread(subject.position.threadId)),
    instructions: (subject.isCompanion
      ? [companionInstructionsOf(subject.position.threadId)]
      : subject.isGuildmaster
        ? [guildmasterInstructionsOf(subject.position.threadId, subject.isChannel), loreInstructions]
        : [threadInstructionsOf(subject.position), journalInstructions, loreInstructions]
    ).join("\n\n"),
    journal: subject.isCompanion
      ? ""
      : subject.isGuildmaster
        ? yield* readGuildmasterContext
        : yield* journalContextOf(subject.missionId, { isBriefingOnly: subject.position.isAside }),
    lore: yield* loreContextOf(subject.loreThreadId),
    openerMessages: openerContextOf(subject.openerMessages, subject.openerTail),
    position: subject.isCompanion
      ? ""
      : [positionLineOf(subject.position), namingLineOf(subject)].filter((line) => line !== null).join(" "),
    workspace,
  } satisfies Sections;
});

// The system part stays the same across a session's turns: rewriting it restarts the process and invalidates
// the cache and earlier thinking. What changes turn to turn, titles included (CHG-0058), rides on the note.
const systemPartOf = (sections: Sections) => [sections.workspace, sections.instructions].join("\n\n");

const noteOf = (sections: Sections) =>
  [sections.position, sections.journal, sections.openerMessages, sections.lore, sections.budget]
    .filter((part) => part !== null)
    .join("\n\n");

/** Who a thread's turn context is for, and where it works. */
export const readThreadSubject = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{
    harness: HarnessName;
    guildmasterId: string | null;
    isAside: number;
    isChannel: number;
    isCompanion: number;
    isGuildmaster: number;
    isTitleByUser: number;
    missionId: string;
    openerMessages: string | null;
    openerTail: string | null;
    parentId: string | null;
    parentTitle: string | null;
    title: string;
    turnCount: number;
  }>`
      SELECT t.mission_id AS missionId, t.harness, t.title, t.parent_id AS parentId, p.title AS parentTitle,
        t.is_aside AS isAside, t.opener_messages AS openerMessages, t.opener_tail AS openerTail,
        ${isQuestKindOf(sql, "chronicler")} AS isGuildmaster, ${isQuestKindOf(sql, "companion")} AS isCompanion,
        m.is_title_by_user AS isTitleByUser,
        (m.chronicler_channel IS NOT NULL) AS isChannel,
        (SELECT COUNT(*) FROM turns u WHERE u.thread_id = t.id) AS turnCount,
        (SELECT g.top_thread_id FROM missions g WHERE ${isQuestKindOf(sql, "chronicler", "g")} AND g.chronicler_channel IS NULL LIMIT 1) AS guildmasterId
      FROM threads t JOIN missions m ON m.id = t.mission_id LEFT JOIN threads p ON p.id = t.parent_id
      WHERE t.id = ${threadId}`;
  if (row === undefined) return yield* notFound("No such thread.");
  const position = {
    guildmasterId: row.isGuildmaster === 1 ? null : row.guildmasterId,
    isAside: row.isAside === 1,
    parent: row.parentId === null ? null : { id: row.parentId, title: row.parentTitle ?? "" },
    threadId,
    title: row.title,
  };
  // A Companion reads the lore of the conversation it was asked in.
  const [companion] = yield* sql<{ parentThreadId: string }>`
    SELECT parent_thread_id AS parentThreadId FROM companion_threads WHERE thread_id = ${threadId}`;
  return {
    harness: row.harness,
    ownCopy: yield* readOwnCopy(threadId),
    subject: {
      isChannel: row.isChannel === 1,
      isCompanion: row.isCompanion === 1,
      isGuildmaster: row.isGuildmaster === 1,
      isTitleByUser: row.isTitleByUser === 1,
      loreThreadId: companion?.parentThreadId ?? threadId,
      missionId: row.missionId,
      openerMessages: row.openerMessages,
      // The turn is admitted before its context is read, so a thread's first turn is the only one it has.
      openerTail: row.turnCount <= 1 ? row.openerTail : null,
      position,
    },
    workspace: yield* readThreadWorkspace(threadId),
  };
});

/** The thread's starting context for its next turn, with its scratch folder made when it has no workspace. */
export const prepareStartingContext = Effect.fnUntraced(function* (threadId: string) {
  const scratchRoot = yield* ScratchRoot;
  const { ownCopy, subject, workspace } = yield* readThreadSubject(threadId);
  const folder = yield* prepareWorkingFolder(workspace, join(scratchRoot, subject.missionId), ownCopy);
  const sections = yield* readSections(subject, folder.context);
  return {
    context: systemPartOf(sections),
    cwd: folder.cwd,
    isInWorkspace: workspace !== null,
    note: noteOf(sections),
  } satisfies TurnContext;
});

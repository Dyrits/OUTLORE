import { join } from "node:path";
import type { HarnessName, ModelChoice, StartingContext } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { notFound, tokensOf } from "../core/index.ts";
import { harnessFacts } from "../harness/index.ts";
import { readContextLimit } from "../lore/index.ts";
import { readApprovalInstructions } from "./approvalTerms.ts";
import { openerMessagesOf, openerTailOf } from "./openerContext.ts";
import { readOwnCopy } from "./ownCopies.ts";
import { readSections, readThreadSubject, tokensOfPart } from "./startingContext.ts";
import { newErrandTitle } from "./titles.ts";
import { readThreadWorkspace, ScratchRoot, workingFolderOf } from "./workspaces.ts";

/** The share of the context window in percent above which the owner is warned before a thread starts (thread-tree, Opening a thread; CHG-0007). */
export const startingContextWarningPercent = 25;

/** Stands in for the id of a thread about to be opened: every id has this length, so the size is the same. */
const unopenedThreadId = "00000000-0000-0000-0000-000000000000";

/**
 * What a thread the owner opens beneath `parentId` with this request would start with, on the chosen harness (the parent's when null) and model.
 * It has the parent's workspace, the parent's messages since the latest journal entry, and no lore of its own yet, so its lore is the parent's.
 * Skills are not counted until tool-and-skill-loading gives them to threads; the thread tools' own descriptions are not counted either.
 */
export const readStartingContext = Effect.fnUntraced(function* (
  parentId: string,
  choice: { readonly harness: HarnessName | null; readonly model: ModelChoice },
  request: string,
) {
  const sql = yield* SqlClient.SqlClient;
  const scratchRoot = yield* ScratchRoot;
  const [parent] = yield* sql<{ harness: HarnessName; missionId: string; title: string }>`
      SELECT harness, mission_id AS missionId, title FROM threads WHERE id = ${parentId}`;
  if (parent === undefined) return yield* notFound("No such thread.");
  const harness = choice.harness ?? parent.harness;
  const workspace = yield* readThreadWorkspace(parentId);
  const folder = yield* workingFolderOf(workspace, join(scratchRoot, parent.missionId), yield* readOwnCopy(parentId));
  const sections = yield* readSections(
    {
      isChannel: false,
      isGuildmaster: false,
      isTitleByUser: false,
      loreThreadId: parentId,
      missionId: parent.missionId,
      openerMessages: yield* openerMessagesOf(parentId),
      // The owner opens it, on its first turn: it would read its opener's latest messages as well.
      openerTail: yield* openerTailOf(parentId),
      position: {
        isAside: false,
        parent: { id: parentId, title: parent.title },
        threadId: unopenedThreadId,
        title: newErrandTitle,
      },
    },
    folder.context,
  );
  const approvals = yield* readApprovalInstructions(parentId, harness);
  const parts = {
    budget: tokensOfPart(sections.budget),
    instructions: tokensOf(sections.instructions) + tokensOf(approvals),
    journal: tokensOf(sections.journal),
    lore: tokensOf(sections.lore),
    openerMessages: tokensOfPart(sections.openerMessages),
    position: tokensOf(sections.position),
    request: tokensOf(request),
    workspace: tokensOf(sections.workspace),
  };
  const tokens = Object.values(parts).reduce((sum, part) => sum + part, 0);
  // The harness's default model has no name: on the parent's own harness it is the model the parent's turns reported.
  const { tokens: windowTokens } = yield* readContextLimit(choice.model, harness === parent.harness ? parentId : null);
  // Every harness without fixed models lists its models only by running (HarnessTools.listModels), so it suggests none here.
  const limits = yield* Effect.forEach(
    (harnessFacts[harness].fixedModels ?? []).map((option) => option.id),
    (model) => readContextLimit(model).pipe(Effect.map((limit) => ({ model, tokens: limit.tokens }))),
  );
  return {
    isOverWarning: tokens * 100 > windowTokens * startingContextWarningPercent,
    // The models whose limit is larger than the chosen one's, largest first: the soft limit holds all large windows alike.
    largerModels: limits
      .filter((limit) => limit.tokens > windowTokens)
      .toSorted((current, next) => next.tokens - current.tokens)
      .map((limit) => limit.model),
    parts,
    tokens,
    warningPercent: startingContextWarningPercent,
    windowTokens,
  } satisfies StartingContext;
});

/** The refusal of a thread whose starting context is over the warning, in words, or null when it may start. */
export const startingContextRefusalOf = (context: StartingContext) =>
  context.isOverWarning
    ? `Not started: its starting context takes about ${Math.round((context.tokens * 100) / context.windowTokens)}% of the model's context window, over the warning at ${context.warningPercent}%. Choose a model with a larger window, trim lore, or start it anyway.`
    : null;

/**
 * The tokens of what Outlore sends a thread each turn, by the parts of the context gauge (thread-panel): the instructions with the working folder, approval rules, and position; the lore; the journal; and the opener's messages.
 * Counted from the text, so they are estimates, and nothing is made on disk.
 */
export const readSentContextSize = Effect.fnUntraced(function* (threadId: string) {
  const scratchRoot = yield* ScratchRoot;
  const { harness, ownCopy, subject, workspace } = yield* readThreadSubject(threadId);
  const folder = yield* workingFolderOf(workspace, join(scratchRoot, subject.missionId), ownCopy);
  const sections = yield* readSections(subject, folder.context);
  const approvals = yield* readApprovalInstructions(threadId, harness);
  return {
    instructions:
      tokensOf(sections.instructions) +
      tokensOf(approvals) +
      tokensOf(sections.workspace) +
      tokensOf(sections.position) +
      tokensOfPart(sections.budget),
    journal: tokensOf(sections.journal),
    lore: tokensOf(sections.lore),
    openerMessages: tokensOfPart(sections.openerMessages),
  };
});

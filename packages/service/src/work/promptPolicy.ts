import { dirname, resolve as resolvePath } from "node:path";
import type { ApprovalLevel } from "@outlore/contracts";
import { Effect, Option } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { fieldOf, Harness, readSettings } from "../core/index.ts";
import { folderEscapeOf, resolvedFolderOf, workspaceWorktreesOf } from "../harness/index.ts";
import {
  consequences,
  findCoveringPermission,
  isUnaskedAt,
  needsOf,
  plainActionOf,
  reasonOf,
  targetOf,
} from "../policy/index.ts";
import { isInsideVaultFolder, searchReachesVaultFolder, VaultFolder } from "../vault/index.ts";
import type { Decision } from "./approvalContracts.ts";
import { type Asked, allowingOutcomes, type makeQuestions, textOf } from "./questions.ts";
import { readAuthorityHarness } from "./turnAdmission.ts";
import { ScratchRoot, threadFolderOf } from "./workspaces.ts";

/** The built-in tools that read files and name a path in one of these fields. */
const readTools: ReadonlyArray<string> = ["Read", "Grep", "Glob", "NotebookRead"];
const pathFields = ["file_path", "path", "notebook_path", "pattern"] as const;

/**
 * The built-in tools that search a whole tree rather than read one named file: their reach is decided by the root
 * they start from, which is the `path` they name or, absent that, the thread's own folder.
 */
const searchTools: ReadonlyArray<string> = ["Grep", "Glob"];

/** Whether a built-in read tool's input names a path in the Vault's folder, relative paths taken from the thread's folder. */
const isReadOfVault = (vaultFolder: string, toolName: string, input: unknown, folder: string | null) =>
  readTools.includes(toolName) &&
  pathFields.some((field) => {
    const path = fieldOf(input, field);
    return typeof path === "string" && isInsideVaultFolder(vaultFolder, path, folder ?? "/");
  });

/**
 * Whether a search tool would walk into the Vault's folder: its root is the `path` it names, or the thread's own
 * folder when it names none, and any root that is the folder or lies above it reaches in — a bare `/`, the owner's
 * home, the Vault's parent, or a link to any of them.
 */
const isSearchOfVault = (vaultFolder: string, toolName: string, input: unknown, folder: string | null) => {
  if (!searchTools.includes(toolName)) return false;
  const named = fieldOf(input, "path");
  const root = typeof named === "string" ? named : (folder ?? "/");
  return searchReachesVaultFolder(vaultFolder, root, folder ?? "/");
};

interface PromptPolicyDependencies {
  readonly allowedFolderOf: (id: string) => string | undefined;
  readonly missionOf: (id: string) => Effect.Effect<string | null, SqlError.SqlError>;
  readonly questions: ReturnType<typeof makeQuestions>;
  readonly readTurnId: (id: string) => Effect.Effect<string | null, SqlError.SqlError>;
  readonly takeAllowance: (
    id: string,
    target: string,
    isOutsideSandbox: boolean,
  ) => Effect.Effect<boolean, SqlError.SqlError>;
}

/** Harness prompts are judged by containment, exact grants and the turn's single-use allowances. */
export const makePromptPolicy = Effect.fnUntraced(function* ({
  questions: { ask, record },
  readTurnId,
  takeAllowance,
  missionOf,
  allowedFolderOf,
}: PromptPolicyDependencies) {
  const sql = yield* SqlClient.SqlClient;
  const harness = yield* Harness;
  const scratchRoot = yield* ScratchRoot;
  // Absent in checks that build no Vault; then no path is refused for lying in it.
  const vaultFolder = yield* Effect.serviceOption(VaultFolder);
  /**
   * The folders a file change must lie in one of to count as inside the thread's: its own, unless it is a link or
   * resolves outside its root (harness/threadFolder.ts), together with the git worktrees git lists for the
   * workspace's repository (CHG-0273). A linked folder counts only as the real path the owner allowed a harness to
   * start in, while it still points there, with no worktrees; otherwise none, and every change asks.
   */
  const editFoldersOf = (threadId: string, folder: string) => {
    const isScratch = dirname(resolvePath(folder)) === resolvePath(scratchRoot);
    if (folderEscapeOf(folder, isScratch ? scratchRoot : folder, !isScratch) === null)
      return [folder, ...workspaceWorktreesOf(folder)];
    const allowed = allowedFolderOf(threadId);
    return allowed !== undefined && allowed === resolvedFolderOf(folder) ? [allowed] : [];
  };

  /**
   * What a harness action needs beyond its sandbox, or null when it is contained (CHG-0208): gathers the facts
   * Containment (policy/containment.ts) judges from, which the adapter reported and the store holds.
   */
  const readCapability = Effect.fnUntraced(function* (
    threadId: string,
    level: ApprovalLevel,
    canWorkOutsideSandbox: boolean,
    toolName: string,
    input: unknown,
    isEscape: boolean,
    isUnsandboxed: boolean,
  ) {
    const stored = yield* threadFolderOf(threadId).pipe(Effect.provideService(ScratchRoot, scratchRoot));
    const authority = yield* readAuthorityHarness(threadId).pipe(Effect.provideService(SqlClient.SqlClient, sql));
    return yield* needsOf({
      canWorkOutsideSandbox,
      containment: authority === null ? "Unprotected" : (harness.containmentOf?.(authority, level) ?? "Unprotected"),
      editFolders: stored === null ? [] : editFoldersOf(threadId, stored),
      input,
      isEscape,
      isUnsandboxed,
      toolName,
    });
  });

  const answerPrompt = (
    threadId: string,
    toolName: string,
    input: unknown,
    isOutsideSandbox: boolean,
    isUnsandboxed: boolean,
  ) =>
    Effect.gen(function* () {
      // A prompt from a harness still exiting after Stop runs nothing and asks nobody.
      if ((yield* readTurnId(threadId)) === null)
        return { isAllowed: false, text: "This thread is not at work, so nothing runs." } satisfies Decision;
      const stored = yield* threadFolderOf(threadId).pipe(Effect.provideService(ScratchRoot, scratchRoot));
      // Claude Code's own Read, Grep and Glob run outside its command sandbox, so its denial of the Vault's folder does
      // not reach them (ADR 0022): a call naming a path in the folder is refused, whatever the level or any grant, and
      // so is a Grep or Glob whose search would walk into the folder from above (work/promptPolicy.ts).
      if (
        Option.isSome(vaultFolder) &&
        (isReadOfVault(vaultFolder.value, toolName, input, stored) ||
          isSearchOfVault(vaultFolder.value, toolName, input, stored))
      )
        return { isAllowed: false, text: "The Vault's folder is closed to threads." } satisfies Decision;
      // What an allowance or a grant names: the file or command the action acts on.
      const target = targetOf(toolName, input);
      const isEscape =
        isOutsideSandbox || (toolName === "Bash" && fieldOf(input, "dangerouslyDisableSandbox") === true);
      if (yield* takeAllowance(threadId, target, isEscape)) return { isAllowed: true, text: "" } satisfies Decision;
      const missionId = yield* missionOf(threadId);
      if (missionId === null) return { isAllowed: false, text: "Unknown thread." } satisfies Decision;
      const { approvalLevel, shouldAllowOutsideSandbox } = yield* readSettings;
      const capability = yield* readCapability(
        threadId,
        approvalLevel,
        shouldAllowOutsideSandbox,
        toolName,
        input,
        isEscape,
        isUnsandboxed,
      );
      const reason = reasonOf(input);
      const plain = plainActionOf(toolName);
      // At the default level a contained action runs and leaves a line, whatever it does: the sandbox holds the
      // damage, and no command is judged by its words.
      if (isUnaskedAt(approvalLevel, capability)) {
        yield* record(
          {
            details: target,
            kind: "Confirmation",
            missionId,
            source: "Harness",
            summary: `${reason ?? plain}.`,
            threadId,
          },
          { message: null, outcome: "AllowedAutomatically" },
        );
        return { isAllowed: true, text: "" } satisfies Decision;
      }
      const asked: Asked = {
        details: toolName === "Bash" ? target : `${target}\n${JSON.stringify(input, null, 2)}`,
        kind: "Approval",
        missionId,
        pattern: target,
        permission: capability ?? plain,
        source: "Harness",
        summary: capability === null ? `${reason ?? plain}.` : `${reason ?? plain}. ${consequences[capability]}`,
        threadId,
      };
      const covering = yield* findCoveringPermission(threadId, target, capability);
      if (covering !== null) {
        yield* record(asked, { message: covering.sentence, outcome: "AllowedByPermission" });
        return { isAllowed: true, text: "" } satisfies Decision;
      }
      const resolution = yield* ask(asked);
      return {
        isAllowed: allowingOutcomes.includes(resolution.outcome),
        text: textOf(resolution),
      } satisfies Decision;
    }).pipe(Effect.orDie);

  return answerPrompt;
});

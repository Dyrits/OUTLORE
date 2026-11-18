import type {
  ArchiveRealm,
  CreateRealm,
  FindArchivedRealm,
  PreviewRealmArchive,
  RenameRealm,
  RestoreRealm,
} from "@outlore/contracts";
import { Effect } from "effect";
import { type CommandRunner, changed } from "./commands.ts";
import { createRealmOutcome } from "./realmCreation.ts";
import {
  archiveRealm,
  findArchivedRealm,
  listArchivedRealms,
  previewRealmArchive,
  restoreRealm,
} from "./realmLifecycle.ts";
import { createRealm, renameRealm } from "./workspaces.ts";

/** Realm request handlers share the command runner's transaction and post-commit cancellation. */
export const realmHandlers = (commands: CommandRunner) => ({
  ArchiveRealm: (given: typeof ArchiveRealm.Type) =>
    commands.run(archiveRealm(given.workspaceId, given.snapshot, given.movedQuestIds)),
  CreateRealm: (given: typeof CreateRealm.Type) =>
    given.shouldAnswerOutcome
      ? commands.run(createRealmOutcome(given))
      : commands.run(createRealm(given.path, given.name, given.allowDuplicateName ?? false).pipe(Effect.map(changed))),
  FindArchivedRealm: (given: typeof FindArchivedRealm.Type) => findArchivedRealm(given.path),
  ListArchivedRealms: () => listArchivedRealms,
  PreviewRealmArchive: (given: typeof PreviewRealmArchive.Type) => previewRealmArchive(given.workspaceId),
  RenameRealm: (given: typeof RenameRealm.Type) =>
    commands.run(
      renameRealm(given.workspaceId, given.name, given.allowDuplicateName ?? false).pipe(Effect.map(changed)),
    ),
  RestoreRealm: (given: typeof RestoreRealm.Type) => commands.run(restoreRealm(given)),
});

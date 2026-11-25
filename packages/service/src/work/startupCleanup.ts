import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Cause, Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { removeScratch } from "../core/index.ts";
import { AttachmentsRoot } from "./attachments.ts";
import { ScratchRoot } from "./workspaces.ts";

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const questFolder = new RegExp(`^${uuid}$`, "i");
const attachmentFile = new RegExp(`^${uuid}\\.(png|jpg|gif|webp)$`, "i");

// This is the startup boundary: failures are observable but must not make the app unusable. It logs here, as the
// process top does, because the cleanup runs once before any caller exists that could receive a failure.
const attemptCleanup = <A, E, R>(target: string, operation: Effect.Effect<A, E, R>) =>
  operation.pipe(
    Effect.catchCause((cause) =>
      Effect.logWarning(`Startup cleanup will retry ${target} on the next start`, Cause.pretty(cause)),
    ),
  );

/** Reconciles service-owned files before Threads or request handlers exist; never run alongside uploads. */
export const reconcileStartupFiles = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const attachments = yield* AttachmentsRoot;
  const scratch = yield* ScratchRoot;
  // A crash before the record insert, or after a deletion commit, leaves no row. Keeping only sent rows
  // covers those windows as well as drafts; a failed removal is found again next start, without a queue.
  yield* sql`DELETE FROM attachments WHERE message_id IS NULL`;
  const keptFiles = new Set((yield* sql<{ file: string }>`SELECT file FROM attachments`).map((row) => row.file));
  const keptQuests = new Set((yield* sql<{ id: string }>`SELECT id FROM missions`).map((row) => row.id));
  yield* attemptCleanup(
    attachments,
    Effect.gen(function* () {
      yield* Effect.tryPromise(() => mkdir(attachments, { recursive: true }));
      const entries = yield* Effect.tryPromise(() => readdir(attachments, { withFileTypes: true }));
      for (const entry of entries) {
        if (entry.isFile() && attachmentFile.test(entry.name) && !keptFiles.has(entry.name)) {
          const path = join(attachments, entry.name);
          yield* attemptCleanup(
            path,
            Effect.tryPromise(() => rm(path, { force: true })),
          );
        }
      }
    }),
  );
  yield* attemptCleanup(
    scratch,
    Effect.gen(function* () {
      yield* Effect.tryPromise(() => mkdir(scratch, { recursive: true }));
      const entries = yield* Effect.tryPromise(() => readdir(scratch, { withFileTypes: true }));
      for (const entry of entries) {
        if (entry.isDirectory() && questFolder.test(entry.name) && !keptQuests.has(entry.name)) {
          const path = join(scratch, entry.name);
          // Preserve the same registered-realm protection as a normal deletion.
          yield* attemptCleanup(path, removeScratch(path));
        }
      }
    }),
  );
});

/** Startup-only cleanup, with both roots supplied before the service foundation exists. */
export const startupCleanupLayer = (attachmentsRoot: string, scratchRoot: string) =>
  Layer.effectDiscard(
    reconcileStartupFiles.pipe(
      Effect.provideService(AttachmentsRoot, attachmentsRoot),
      Effect.provideService(ScratchRoot, scratchRoot),
    ),
  );

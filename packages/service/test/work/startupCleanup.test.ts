import { chmodSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { removeScratch } from "../../src/core/index.ts";
import { fakeHarnessLayer, serviceLayer } from "../../src/index.ts";
import { deleteThread } from "../../src/work/deleting.ts";
import { Commands, makeCommands, Threads } from "../../src/work/index.ts";
import { call, fixture, read, register, settle } from "../fixtures/service.ts";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(24).fill(0)]);
const restart = (directory: string) =>
  serviceLayer({
    filename: join(directory, "store.sqlite"),
    harness: fakeHarnessLayer("10 millis"),
    homeFolder: directory,
    scratchRoot: join(directory, "missions"),
  });

const createQuest = Effect.gen(function* () {
  const card = yield* call({ _tag: "AddAttachment", data: png.toString("base64"), name: "sent.png" });
  const started = yield* call({
    _tag: "StartMission",
    attachmentIds: [card.id],
    effort: "default",
    model: "default",
    requestId: crypto.randomUUID(),
    text: "see",
    workspacePath: null,
  });
  const detail = yield* settle(started.missionId, (detail) => detail.thread.state === "Idle");
  return { card, detail, started };
});

describe("startup reconciliation before any upload can start", () => {
  it.live("keeps unknown scratch folders and a deleted quest folder registered as a realm", () =>
    Effect.gen(function* () {
      const value = register(fixture());
      const unknown = join(value.directory, "missions", "owner-folder");
      const protectedFolder = join(value.directory, "missions", crypto.randomUUID());
      const orphan = join(value.directory, "missions", crypto.randomUUID());
      yield* Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        for (const folder of [unknown, protectedFolder, orphan]) {
          mkdirSync(folder, { recursive: true });
          writeFileSync(join(folder, "keep.txt"), "keep");
        }
        yield* sql`INSERT INTO workspaces (id, name, path, created_at) VALUES ('kept', 'Kept', ${protectedFolder}, 1)`;
      }).pipe(Effect.provide(value.layer));
      yield* call({ _tag: "ListOpenQuestions" }).pipe(Effect.provide(restart(value.directory)));
      expect(existsSync(unknown)).toBe(true);
      expect(existsSync(protectedFolder)).toBe(true);
      expect(existsSync(orphan)).toBe(false);
    }),
  );
  it.live("removes a pre-insert file, keeps sent images and unknown files, and is idempotent", () =>
    Effect.gen(function* () {
      const value = register(fixture());
      const { card } = yield* createQuest.pipe(Effect.provide(value.layer));
      const orphan = join(value.directory, "attachments", `${crypto.randomUUID()}.png`);
      const unknown = join(value.directory, "attachments", "owner-notes.txt");
      writeFileSync(orphan, png);
      writeFileSync(unknown, "keep");
      for (let count = 0; count < 2; count++) {
        yield* Effect.gen(function* () {
          expect((yield* call({ _tag: "ReadAttachment", attachmentId: card.id })).mediaType).toBe("image/png");
          expect(existsSync(orphan)).toBe(false);
          expect(existsSync(unknown)).toBe(true);
        }).pipe(Effect.provide(restart(value.directory)));
      }
    }),
  );

  it.live("starts despite an unremovable file and retries on the next start", () =>
    Effect.gen(function* () {
      const value = register(fixture());
      yield* createQuest.pipe(Effect.provide(value.layer));
      const root = join(value.directory, "attachments");
      const orphan = join(root, `${crypto.randomUUID()}.png`);
      writeFileSync(orphan, png);
      chmodSync(root, 0o500);
      try {
        yield* call({ _tag: "ListOpenQuestions" }).pipe(Effect.provide(restart(value.directory)));
        expect(existsSync(orphan)).toBe(true);
      } finally {
        chmodSync(root, 0o700);
      }
      yield* call({ _tag: "ListOpenQuestions" }).pipe(Effect.provide(restart(value.directory)));
      expect(existsSync(orphan)).toBe(false);
    }),
  );

  for (const stage of ["before scratch", "after scratch", "after marker", "before commit"] as const) {
    it.live(`recovers a deletion interrupted ${stage}`, () =>
      Effect.gen(function* () {
        const value = register(fixture());
        const result = yield* Effect.gen(function* () {
          const result = yield* createQuest;
          const sql = yield* SqlClient.SqlClient;
          const threads = yield* Threads;
          const scratch = join(value.directory, "missions", result.started.missionId);
          mkdirSync(scratch, { recursive: true });
          writeFileSync(join(scratch, "work.txt"), "work");
          const preview = yield* call({ _tag: "PreviewDeletion", threadId: result.started.threadId });
          const runner = makeCommands({
            publish: Effect.void,
            removeScratch: () =>
              stage === "before scratch"
                ? Effect.die("cut before scratch")
                : removeScratch(scratch).pipe(
                    Effect.provideService(SqlClient.SqlClient, sql),
                    Effect.orDie,
                    Effect.andThen(Effect.die("cut after scratch")),
                  ),
            sql,
            threads,
            withdrawQuestions: () => Effect.void,
          });
          if (stage === "before commit")
            yield* sql`CREATE TRIGGER cut_delete BEFORE DELETE ON missions
          BEGIN SELECT RAISE(ABORT, 'cut before commit'); END`;
          let runs = 0;
          const commands = {
            ...runner,
            run: <A, E, R>(operation: Parameters<typeof runner.run<A, E, R>>[0]) => {
              runs++;
              if (stage === "before commit" && runs === 3) return Effect.die("cut before compensation");
              return runner
                .run(operation)
                .pipe(
                  Effect.tap(() =>
                    stage === "after marker" && runs === 1 ? Effect.die("cut after marker") : Effect.void,
                  ),
                );
            },
          };
          yield* deleteThread(result.started.threadId, preview.confirmation).pipe(
            Effect.provideService(Commands, commands),
            Effect.exit,
          );
          if (stage === "before commit") yield* sql`DROP TRIGGER cut_delete`;
          const rows = yield* sql<{ file: string }>`SELECT file FROM attachments WHERE id = ${result.card.id}`;
          if (stage === "after marker" || stage === "before commit") {
            expect(rows).toHaveLength(1);
            expect(existsSync(join(value.directory, "attachments", rows[0]?.file ?? "missing"))).toBe(true);
          } else expect(rows).toHaveLength(0);
          return result;
        }).pipe(Effect.provide(value.layer));
        for (let count = 0; count < 2; count++) {
          yield* Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            if (stage === "after marker" || stage === "before commit") {
              const [row] = yield* sql<{
                deleting: number;
              }>`SELECT is_deleting AS deleting FROM threads WHERE id = ${result.started.threadId}`;
              expect(row?.deleting).toBe(0);
              expect((yield* read(result.started.missionId)).thread.state).toBe("Stopped");
              expect((yield* call({ _tag: "ReadAttachment", attachmentId: result.card.id })).mediaType).toBe(
                "image/png",
              );
            } else {
              expect(existsSync(join(value.directory, "missions", result.started.missionId))).toBe(false);
              expect((yield* Effect.flip(call({ _tag: "ReadAttachment", attachmentId: result.card.id }))).kind).toBe(
                "NotFound",
              );
              expect(readdirSync(join(value.directory, "attachments"))).toEqual([]);
            }
          }).pipe(Effect.provide(restart(value.directory)));
        }
      }),
    );
  }
});

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { call, fixture, read, settle } from "../fixtures/service.ts";

// A deletion that fails while erasing its records leaves the quest whole and deletable again (thread-tree, fault injection).

const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const attachmentFiles = (directory: string) => {
  const folder = join(directory, "attachments");
  return existsSync(folder) ? readdirSync(folder) : [];
};

describe("a deletion whose erasing fails", () => {
  it.live("keeps the quest and its files, and deletes them when asked again", () => {
    const value = fixture();
    fixtures.push(value);
    return Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const card = yield* call({
        _tag: "AddAttachment",
        data: Buffer.concat([pngSignature, Buffer.alloc(24)]).toString("base64"),
        name: "shot.png",
      });
      const started = yield* call({
        _tag: "StartMission",
        attachmentIds: [card.id],
        effort: "default",
        model: "default",
        requestId: crypto.randomUUID(),
        text: "see",
        workspacePath: null,
      });
      const detail = yield* settle(started.missionId, (d) => d.thread.state === "Idle");
      const preview = yield* call({ _tag: "PreviewDeletion", threadId: detail.thread.id });
      // The last record to go, after the attachments' rows and the messages have been deleted.
      yield* sql`CREATE TRIGGER fail_quest_erase BEFORE DELETE ON missions
        BEGIN SELECT RAISE(ABORT, 'injected failure'); END`;

      yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: detail.thread.id }).pipe(
        Effect.flip,
      );

      // Rows and files agree: the image is still there and the quest is not stuck as deleting.
      expect(attachmentFiles(value.directory)).toHaveLength(1);
      expect((yield* call({ _tag: "ReadAttachment", attachmentId: card.id })).mediaType).toBe("image/png");
      expect((yield* read(started.missionId)).thread.id).toBe(detail.thread.id);

      yield* sql`DROP TRIGGER fail_quest_erase`;
      const again = yield* call({ _tag: "PreviewDeletion", threadId: detail.thread.id });
      yield* call({ _tag: "DeleteThread", confirmation: again.confirmation, threadId: detail.thread.id });
      expect(attachmentFiles(value.directory)).toEqual([]);
      expect((yield* Effect.flip(read(started.missionId))).kind).toBe("NotFound");
    }).pipe(Effect.provide(value.layer));
  });
});

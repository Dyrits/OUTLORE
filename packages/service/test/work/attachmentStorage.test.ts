import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { call, fixture } from "../fixtures/service.ts";

// What an attached file leaves on disk when its record cannot be written (message-attachments, fault injection).

const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const png = Buffer.concat([pngSignature, Buffer.alloc(24)]);

describe("adding an attachment whose record cannot be written", () => {
  it.live("refuses the file and leaves no file in the attachments folder", () => {
    const value = fixture();
    fixtures.push(value);
    return Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`CREATE TRIGGER fail_attachment_record BEFORE INSERT ON attachments
        BEGIN SELECT RAISE(ABORT, 'injected failure'); END`;

      const refusal = yield* call({ _tag: "AddAttachment", data: png.toString("base64"), name: "shot.png" }).pipe(
        Effect.flip,
      );

      expect(refusal).toBeDefined();
      const folder = join(value.directory, "attachments");
      expect(existsSync(folder) ? readdirSync(folder) : []).toEqual([]);
    }).pipe(Effect.provide(value.layer));
  });
});

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { Service } from "../../src/serviceTag.ts";
import { call, settle, start, withService } from "../fixtures/service.ts";

describe("admitting a request source", () => {
  it.live("refuses a paired device's host-only request at the service boundary", () =>
    withService(
      Effect.gen(function* () {
        const service = yield* Service;
        const refused = yield* Effect.flip(service.handle({ _tag: "ReadRemoteAccess" }, { isPairedDevice: true }));
        expect(refused.kind).toBe("AccessRefused");
      }),
    ),
  );

  for (const paired of [false, true]) {
    it.live(`records the answering ${paired ? "paired device's name" : "host window"} on an approval`, () =>
      withService(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const service = yield* Service;
          if (paired)
            yield* sql`INSERT INTO paired_devices (id, kind, last_active_at, name, paired_at, token_hash)
          VALUES ('phone', 'phone', 0, 'My phone', 0, X'00')`;
          const quest = yield* start('ask {"action":"Push code","command":"git push"}');
          yield* settle(quest.missionId, (detail) => detail.thread.state === "Attention");
          const [question] = yield* call({ _tag: "ListOpenQuestions" });
          if (question === undefined) return yield* Effect.die("No approval question.");
          const source = { deviceId: paired ? "phone" : null, isPairedDevice: paired };
          yield* service.handle(
            { _tag: "AnswerQuestion", answer: "Allow", message: null, questionId: question.id },
            source,
          );
          const [row] = yield* sql<{ device: string }>`SELECT device FROM questions WHERE id = ${question.id}`;
          expect(row?.device).toBe(paired ? "My phone" : "host window");
        }),
      ),
    );
  }
});

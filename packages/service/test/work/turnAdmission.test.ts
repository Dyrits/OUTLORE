import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { admitTurn } from "../../src/work/turnAdmission.ts";
import { call, open, settle, start, withService } from "../fixtures/service.ts";

describe("admitting a background wake", () => {
  it.live("refuses an archived errand whose last turn already ended", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* start();
        yield* settle(quest.missionId, (detail) => detail.thread.state === "Resting");
        const errand = yield* open(quest.threadId);
        yield* settle(quest.missionId, (detail) => detail.thread.state === "Resting", errand.threadId);
        yield* call({ _tag: "ArchiveThread", threadId: errand.threadId });

        expect(yield* admitTurn(errand.threadId, true)).toBeNull();
      }),
    ),
  );

  it.live.each(["Fulfilled", "Archived"] as const)("refuses a thread in a quest marked %s", (ending) =>
    withService(
      Effect.gen(function* () {
        const quest = yield* start();
        yield* settle(quest.missionId, (detail) => detail.thread.state === "Resting");
        const { snapshot } = yield* call({ _tag: "PreviewEnding", ending, missionId: quest.missionId });
        yield* call({ _tag: "EndMission", ending, missionId: quest.missionId, snapshot });

        expect(yield* admitTurn(quest.threadId, true)).toBeNull();
      }),
    ),
  );
});

import { renameSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { call, sendTo, settle, startMission } from "../fixtures/service.ts";
import {
  acpPidsOf,
  answerOpen,
  idleWith,
  linkedFolders,
  linkInPlace,
  openQuestionOf,
  realHomes,
  replies,
  seatbeltIn,
  withHarnesses,
} from "../fixtures/standIns.ts";
import { canApplySeatbelt } from "../support/environment.ts";

const _standIn = [join(import.meta.dirname, "..", "fixtures", "stand-in-opencode.mjs")];
const _spawnChild = join(import.meta.dirname, "..", "fixtures", "stand-in-spawn-child.mjs");
describe("running OpenCode in a folder that is, or became, a link", () => {
  it.live(
    "asks before an edit in a folder that is a link when no sandbox tool exists, without asking about the start",
    () => {
      const { layer } = withHarnesses("50 millis");
      const { elsewhere, workspace } = linkedFolders();
      return Effect.gen(function* () {
        const started = yield* startMission({ harness: "opencode", text: "one", workspacePath: workspace });
        yield* settle(started.missionId, idleWith(1));
        yield* Effect.sleep("200 millis");
        linkInPlace(workspace, elsewhere);
        yield* sendTo(started.threadId, "edit notes/plan.md");
        // The only question is the edit's: nothing is sandboxed, so there is no start to ask about.
        const edit = yield* answerOpen("Deny");
        expect(edit.permission).toBe("Change a file outside the workspace");
        yield* settle(started.missionId, idleWith(2));
      }).pipe(Effect.provide(layer));
    },
  );

  it.live.skipIf(!canApplySeatbelt)(
    "asks before running a thread whose workspace folder became a link, then runs it unsandboxed, asking per action",
    () => {
      const { layer, logged } = withHarnesses("50 millis", seatbeltIn(realHomes()));
      const { elsewhere, workspace } = linkedFolders();
      return Effect.gen(function* () {
        const started = yield* startMission({ harness: "opencode", text: "one", workspacePath: workspace });
        yield* settle(started.missionId, idleWith(1));
        yield* Effect.sleep("200 millis");
        linkInPlace(workspace, elsewhere);
        yield* sendTo(started.threadId, "run ls");
        // A boundary anomaly: each start asks, and the question offers no standing permission (no Always allow).
        const open = yield* openQuestionOf();
        expect(open).toMatchObject({ pattern: null, permission: null });
        const refused = yield* Effect.flip(
          call({ _tag: "AnswerQuestion", answer: "AlwaysAllow", message: null, questionId: open.id }),
        );
        expect(refused.message).toContain("one-time");
        const asked = yield* answerOpen("Allow");
        expect(asked.outcome).toBe("Allowed");
        expect((yield* call({ _tag: "ReadPermissions", missionId: null })).permissions).toEqual([]);
        expect(asked.summary).toContain(workspace);
        expect(asked.summary).toContain(elsewhere);
        expect(asked.summary).toContain("write outside the workspace");
        // Allowed: OpenCode runs where the link points, with no sandbox, and every command asks.
        const command = yield* answerOpen("Allow");
        expect(command).toMatchObject({ details: "ls", permission: "Run without a sandbox" });
        expect(replies(yield* settle(started.missionId, idleWith(2))).at(-1)).toBe("ls: once ");
        const unwrapped = logged().filter((entry) => entry.pid !== undefined && entry.args?.includes("acp"))[1];
        expect(unwrapped?.xdg?.data).toBe(process.env.XDG_DATA_HOME ?? null);
      }).pipe(Effect.provide(layer));
    },
  );

  it.live.skipIf(!canApplySeatbelt)("asks before an edit inside the linked folder once running unsandboxed", () => {
    const { layer } = withHarnesses("50 millis", seatbeltIn(realHomes()));
    const { elsewhere, workspace } = linkedFolders();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "one", workspacePath: workspace });
      yield* settle(started.missionId, idleWith(1));
      yield* Effect.sleep("200 millis");
      linkInPlace(workspace, elsewhere);
      yield* sendTo(started.threadId, "edit notes/plan.md");
      yield* answerOpen("Allow");
      const edit = yield* answerOpen("Deny");
      expect(edit.permission).toBe("Change a file outside the workspace");
      yield* settle(started.missionId, idleWith(2));
    }).pipe(Effect.provide(layer));
  });

  for (const [label, target] of [
    ["the whole disk", () => "/"],
    ["a folder outside the scratch root", () => linkedFolders().elsewhere],
  ] as const)
    it.live.skipIf(!canApplySeatbelt)(
      `fails the turn with the reason when the owner refuses a scratch folder linked to ${label}`,
      () => {
        const { directory, layer, logged } = withHarnesses("50 millis", seatbeltIn(realHomes()));
        const pointed = target();
        return Effect.gen(function* () {
          const started = yield* startMission({ harness: "opencode", text: "one" });
          yield* settle(started.missionId, idleWith(1));
          yield* Effect.sleep("200 millis");
          const scratch = join(directory, "missions", started.missionId);
          linkInPlace(scratch, pointed);
          yield* sendTo(started.threadId, "two");
          const asked = yield* answerOpen("Deny");
          expect(asked.summary).toContain(scratch);
          expect(asked.summary).toContain(`points to ${pointed}`);
          const detail = yield* settle(started.missionId, (current) => current.thread.state === "Failed");
          expect(detail.thread.failure).toContain(scratch);
          expect(detail.thread.failure).toContain("outside the workspace");
          // No OpenCode started for the refused turn, sandboxed or not.
          expect(acpPidsOf(logged)).toHaveLength(1);
        }).pipe(Effect.provide(layer));
      },
    );

  it.live.skipIf(!canApplySeatbelt)("asks when the scratch root itself became a link", () => {
    const { directory, layer, logged } = withHarnesses("50 millis", seatbeltIn(realHomes()));
    const { elsewhere } = linkedFolders();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "one" });
      yield* settle(started.missionId, idleWith(1));
      yield* Effect.sleep("200 millis");
      const root = join(directory, "missions");
      renameSync(root, join(elsewhere, "missions"));
      symlinkSync(join(elsewhere, "missions"), root);
      yield* sendTo(started.threadId, "two");
      const asked = yield* answerOpen("Deny");
      expect(asked.summary).toContain(root);
      expect(asked.summary).toContain(join(elsewhere, "missions"));
      yield* settle(started.missionId, (current) => current.thread.state === "Failed");
      expect(acpPidsOf(logged)).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  it.live.skipIf(!canApplySeatbelt)("runs a thread in a plain workspace folder sandboxed, asking nothing", () => {
    const { layer, logged } = withHarnesses("10 minutes", seatbeltIn(realHomes()));
    const { workspace } = linkedFolders();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "run ls", workspacePath: workspace });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.questions.map((question) => question.outcome)).toEqual(["AllowedAutomatically"]);
      const wrapped = logged().find((entry) => entry.pid !== undefined && entry.args?.includes("acp"));
      expect(wrapped?.cwd).toBe(workspace);
      expect(wrapped?.xdg?.data).not.toBe(process.env.XDG_DATA_HOME ?? null);
    }).pipe(Effect.provide(layer));
  });
});

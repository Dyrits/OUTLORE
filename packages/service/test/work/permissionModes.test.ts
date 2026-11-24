import { describe, expect, it } from "@effect/vitest";
import type { ThreadPermissionMode } from "@outlore/contracts";
import { Effect } from "effect";
import { call, isAsking, isReplied, live, settle, start } from "../fixtures/approvals.ts";

// What each of the four permission modes means for a harness that runs inside an enforced sandbox (CHG-0617,
// CHG-0621), pinned through the owner's questions so the mode table and its readers can change without changing it.

const prompts = {
  command: `prompt Bash ${JSON.stringify({ command: "git status" })}`,
  editInside: `prompt Edit ${JSON.stringify({ file_path: "notes/plan.md" })}`,
  editOutside: `prompt Edit ${JSON.stringify({ file_path: "../elsewhere/plan.md" })}`,
  escape: `prompt Bash ${JSON.stringify({ command: "ls", dangerouslyDisableSandbox: true })}`,
  widenSandbox: `prompt Permissions ${JSON.stringify({ reason: "widen the sandbox" })}`,
};

const expected: Record<ThreadPermissionMode, Record<keyof typeof prompts, "asks" | "runs">> = {
  Auto: { command: "runs", editInside: "runs", editOutside: "asks", escape: "asks", widenSandbox: "asks" },
  AutoAcceptEdits: { command: "asks", editInside: "runs", editOutside: "asks", escape: "asks", widenSandbox: "asks" },
  FullAccess: { command: "runs", editInside: "runs", editOutside: "runs", escape: "runs", widenSandbox: "asks" },
  Supervised: { command: "asks", editInside: "asks", editOutside: "asks", escape: "asks", widenSandbox: "asks" },
};

describe("what each permission mode lets a sandboxed thread do without asking", () => {
  for (const mode of ["Supervised", "AutoAcceptEdits", "Auto", "FullAccess"] as const) {
    it.live(
      `${mode}`,
      () =>
        Effect.gen(function* () {
          const settings = yield* call({ _tag: "ReadSettings" });
          yield* call({ _tag: "UpdateSettings", settings: { ...settings, defaultPermissionMode: mode } });
          const outcomes: Record<string, "asks" | "runs"> = {};
          for (const [name, text] of Object.entries(prompts)) {
            const started = yield* start(text);
            const detail = yield* settle(started.missionId, (current) => isAsking(current) || isReplied(current));
            outcomes[name] = isAsking(detail) ? "asks" : "runs";
          }
          expect(outcomes).toEqual(expected[mode]);
        }).pipe(Effect.provide(live())),
      // Five prompts each settle through the live service, which outlasts the default timeout on a loaded machine.
      30_000,
    );
  }
});

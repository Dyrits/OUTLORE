import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import type { StructuralTool } from "../../src/work/guildmasterProvenance.ts";
import { deriveAction } from "../../src/work/guildmasterProvenance.ts";
import type { ArgumentsOf } from "../../src/work/threadTools.ts";
import { readRunningTurnId } from "../../src/work/turnAdmission.ts";
import { guildmaster, say, startIdle } from "../fixtures/guildmaster.ts";
import { fixture, settle, startNamed } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

// The receipt of an authorized structural action holds the fingerprint it was derived with and is compared with a fresh
// derivation when the action runs. These tests write the fingerprint out by hand, key by key, so that restructuring how
// the actions are derived cannot change it unnoticed: a changed fingerprint would refuse every authorized action.

describe("fingerprinting a structural action for its authorization receipt", () => {
  it.live("holds the arguments, caller, tool, turn, and the state each action depends on, in that order", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const idle = yield* startIdle("Weekly report draft");
      const working = yield* startNamed("wait 5000");
      yield* settle(working.missionId, (detail) => detail.thread.state === "Underway");
      yield* say(place.threadId, "wait 5000");
      yield* settle(place.missionId, (detail) => detail.thread.state === "Underway", place.threadId);
      const turnId = yield* readRunningTurnId(place.threadId);
      const callerId = place.threadId;
      const derive = <Tool extends StructuralTool>(tool: Tool, args: ArgumentsOf<Tool>) =>
        deriveAction(callerId, tool, args);
      // Written as text, since a formatter sorts the keys of an object written out.
      const fingerprintOf = (tool: string, args: object, state: string | object) =>
        `{"args":${JSON.stringify(args)},"callerId":"${callerId}","tool":"${tool}","turnId":"${turnId}","state":${typeof state === "string" ? state : JSON.stringify(state)}}`;
      const quest = (id: string, title: string) => `{"id":"${id}","title":"${title}","ending":null}`;

      const setting = { setting: "shouldShowFinishedQuests", value: "true" };
      const changed = yield* derive("change_setting", setting);
      const settingState = { before: false, setting: "shouldShowFinishedQuests", value: true };
      expect(changed?.fingerprint).toBe(fingerprintOf("change_setting", setting, settingState));
      expect(changed?.details).toBe(JSON.stringify({ action: "ChangeSetting", state: settingState }, null, 2));
      expect(changed?.summary).toBe("Change the setting shouldShowFinishedQuests from false to true.");

      const rename = {
        action: "Rename",
        mission: idle.missionId,
        title: "Weekly report",
      } satisfies ArgumentsOf<"act_on_mission">;
      const renamed = yield* derive("act_on_mission", rename);
      expect(renamed?.fingerprint).toBe(
        fingerprintOf("act_on_mission", rename, `{"quest":${quest(idle.missionId, "Weekly report draft")}}`),
      );

      const stop = { action: "Stop", mission: working.missionId } satisfies ArgumentsOf<"act_on_mission">;
      const stopped = yield* derive("act_on_mission", stop);
      expect(stopped?.fingerprint).toBe(
        fingerprintOf(
          "act_on_mission",
          stop,
          `{"ids":["${working.threadId}"],"quest":${quest(working.missionId, "wait 5000")}}`,
        ),
      );

      const doneArgs = { action: "Done", mission: idle.missionId } satisfies ArgumentsOf<"act_on_mission">;
      const done = yield* derive("act_on_mission", doneArgs);
      expect(done?.fingerprint).toBe(
        fingerprintOf(
          "act_on_mission",
          doneArgs,
          `{"quest":${quest(idle.missionId, "Weekly report draft")},"snapshot":"[]"}`,
        ),
      );

      const ritual = {
        effort: "default",
        harness: "claude",
        instruction: "Say hello to me",
        model: "default",
        schedule: { _tag: "Hourly", hours: 1 },
        title: "Hourly hello",
      } satisfies ArgumentsOf<"create_ritual">;
      const created = yield* derive("create_ritual", ritual);
      expect(created?.fingerprint).toBe(
        fingerprintOf(
          "create_ritual",
          ritual,
          '{"companion":{"accountId":null,"effort":"default","harness":"claude","model":"default"},"realm":null,"title":"Hourly hello"}',
        ),
      );
      expect(Object.keys(JSON.parse(created?.details ?? "{}"))).toEqual([
        "action",
        "companion",
        "fallbacks",
        "instruction",
        "schedule",
        "state",
      ]);
    }).pipe(Effect.provide(setup().layer)),
  );
});

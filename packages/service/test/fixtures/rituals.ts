import type {
  CreateRitualResult,
  MissionDetail,
  Request,
  RitualCompanion,
  RitualSchedule,
  ThreadSummary,
} from "@outlore/contracts";
import { MissionId } from "@outlore/contracts";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { afterEach } from "vitest";
import { call, fixture } from "./service.ts";

// What the Ritual tests share: a service to run in, and the requests that make and run a Ritual. A Ritual is an
// entity of its realm (CHG-0616): each run an errand beneath it, its conversation the run history (rituals.ts).

const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});
export const withService = <A, E, R>(body: Effect.Effect<A, E, R>) => {
  const value = fixture();
  fixtures.push(value);
  return body.pipe(Effect.provide(value.layer));
};

export const claude: RitualCompanion = {
  accountId: null,
  effort: "default",
  harness: "claude",
  model: "claude-sonnet-5-5",
};
export const codex: RitualCompanion = { accountId: null, effort: "default", harness: "codex", model: "gpt-5" };
export const daily: RitualSchedule = { _tag: "Daily", time: "07:00" };

/** Creates a Ritual; the instruction is the fake harness's script. */
export const create = (
  instruction: string,
  more: {
    fallbacks?: ReadonlyArray<RitualCompanion>;
    /** The quest the Ritual comes from, whose realm it then shares (Rituals, Creation). */
    originMissionId?: string;
    schedule?: RitualSchedule;
    title?: string;
    workspacePath?: string | null;
  } = {},
) => {
  const request: Extract<Request, { _tag: "CreateRitual" }> = {
    _tag: "CreateRitual",
    fallbacks: more.fallbacks ?? [],
    instruction,
    primary: claude,
    requestId: crypto.randomUUID(),
    schedule: more.schedule ?? daily,
    title: more.title ?? "Morning digest",
    workspacePath: more.workspacePath ?? null,
    ...(more.originMissionId === undefined ? {} : { originMissionId: MissionId.make(more.originMissionId) }),
  };
  return call(request);
};
export const readRitual = (missionId: MissionId) => call({ _tag: "ReadRitual", missionId });
export const run = (created: CreateRitualResult) => call({ _tag: "RunRitual", ritualId: created.ritualId });

/** The errand of the latest run beneath the Ritual, or null while none ran. */
export const runErrandOf = (detail: MissionDetail): ThreadSummary | null =>
  detail.threads.findLast((thread) => thread.parentId === detail.mission.topThreadId && thread.isAside === false) ??
  null;

export const isIdle = (detail: { thread: { state: string } }) => detail.thread.state === "Resting";

export const replies = (detail: { messages: ReadonlyArray<{ sender: string; text: string }> }) =>
  detail.messages.filter((message) => message.sender === "agent").map((message) => message.text);

export const advance = (millis: number) =>
  Effect.gen(function* () {
    yield* TestClock.adjust(millis);
    for (let index = 0; index < 40; index++) yield* Effect.yieldNow;
  });

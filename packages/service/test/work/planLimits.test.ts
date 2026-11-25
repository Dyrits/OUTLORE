import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { afterEach } from "vitest";
import { Harness, HarnessFailure, type PlanLimitsReport } from "../../src/core/index.ts";
import { fakeHarnessLayer } from "../../src/index.ts";
import { call, fixture } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const report: PlanLimitsReport = {
  billing: "Subscription",
  windows: [{ resetsAtSeconds: 1_794_405_450, usedPercent: 40, windowMinutes: 300 }],
};

/** A harness whose plan-limit answer the test changes between reads; the rest is the scripted fake. */
const withAnswer = (answer: { current: PlanLimitsReport | null | "fail" }) =>
  Layer.effect(
    Harness,
    Effect.gen(function* () {
      const fake = yield* Harness;
      return Harness.of({
        ...fake,
        readPlanLimits: () =>
          answer.current === "fail"
            ? Effect.fail(new HarnessFailure({ reason: "No answer." }))
            : Effect.succeed(answer.current),
      });
    }),
  ).pipe(Layer.provide(fakeHarnessLayer("10 millis")));

const advance = (millis: number) =>
  Effect.gen(function* () {
    yield* TestClock.adjust(millis);
    for (let index = 0; index < 40; index++) yield* Effect.yieldNow;
  });

/** The computer's own Claude Code reading as the budgets list gives it; asking also starts a read when one is due. */
const reading = Effect.gen(function* () {
  const budgets = yield* call({ _tag: "ReadAccountBudgets" });
  return budgets.find((budget) => budget.harness === "claude" && budget.accountId === null)?.planLimits ?? null;
});

/** Asks twice with the clock advanced past the reading's time: the first starts a read, the second sees its result. */
const readAfterAWhile = Effect.gen(function* () {
  yield* advance(5 * 60 * 1000);
  yield* reading;
  yield* advance(10);
  return yield* reading;
});

const withAnswers = (answer: { current: PlanLimitsReport | null | "fail" }) => {
  const value = fixture(undefined, undefined, withAnswer(answer));
  fixtures.push(value);
  return value.layer;
};

describe("an account's plan limits", () => {
  it.effect("keeps the last reading after a failed read", () => {
    const answer: { current: PlanLimitsReport | null | "fail" } = { current: report };
    return Effect.gen(function* () {
      expect(yield* readAfterAWhile).toMatchObject({ windows: [{ label: "5-hour", usedPercent: 40 }] });
      answer.current = "fail";
      expect(yield* readAfterAWhile).toMatchObject({ windows: [{ label: "5-hour", usedPercent: 40 }] });
    }).pipe(Effect.provide(withAnswers(answer)));
  });

  it.effect("shows none once the harness answers that the account has no plan limits", () => {
    const answer: { current: PlanLimitsReport | null | "fail" } = { current: report };
    return Effect.gen(function* () {
      expect(yield* readAfterAWhile).not.toBeNull();
      answer.current = null;
      expect(yield* readAfterAWhile).toBeNull();
    }).pipe(Effect.provide(withAnswers(answer)));
  });

  it.effect("shows none once the harness answers an empty list of windows, as for an API key", () => {
    const answer: { current: PlanLimitsReport | null | "fail" } = { current: report };
    return Effect.gen(function* () {
      expect(yield* readAfterAWhile).not.toBeNull();
      answer.current = { billing: "ApiKey", windows: [] };
      expect(yield* readAfterAWhile).toBeNull();
    }).pipe(Effect.provide(withAnswers(answer)));
  });

  it.effect("names a window by the label its harness gives it, so two windows of one length stay distinct", () => {
    const answer: { current: PlanLimitsReport | null | "fail" } = {
      current: {
        billing: "Subscription",
        windows: [
          { label: "Gemini Models · 5-hour", resetsAtSeconds: 1_794_405_450, usedPercent: 4, windowMinutes: 300 },
          { label: "Claude and GPT models · 5-hour", resetsAtSeconds: 0, usedPercent: 0, windowMinutes: 300 },
          { resetsAtSeconds: 1_794_405_450, usedPercent: 40, windowMinutes: 10_080 },
        ],
      },
    };
    return Effect.gen(function* () {
      const read = yield* readAfterAWhile;
      expect(read?.windows.map((window) => window.label)).toEqual([
        "Gemini Models · 5-hour",
        "Claude and GPT models · 5-hour",
        "Weekly",
      ]);
    }).pipe(Effect.provide(withAnswers(answer)));
  });
});

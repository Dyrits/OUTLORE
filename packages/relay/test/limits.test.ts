import { it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect } from "vitest";
import { defaultSourceLimits, RateWindow, SourceGate } from "../src/limits.ts";

// How the relay counts connection attempts per source, on the test clock: a source over its limit is refused until
// its oldest attempts age out of the window, and one source never counts against another.

describe("a rate window", () => {
  it("admits up to its limit and refuses the next", () => {
    const window = new RateWindow(3, 1_000);
    expect([0, 1, 2, 3].map(() => window.admit("a", 0))).toEqual([true, true, true, false]);
  });

  it("admits again once the oldest attempt has aged out, and a refusal does not extend the wait", () => {
    const window = new RateWindow(2, 1_000);
    window.admit("a", 0);
    window.admit("a", 400);
    expect(window.admit("a", 999)).toBe(false);
    expect(window.admit("a", 1_000)).toBe(true);
    expect(window.admit("a", 1_000)).toBe(false);
    expect(window.admit("a", 1_400)).toBe(true);
  });

  it("counts each key apart", () => {
    const window = new RateWindow(1, 1_000);
    expect(window.admit("a", 0)).toBe(true);
    expect(window.admit("b", 0)).toBe(true);
    expect(window.admit("a", 1)).toBe(false);
  });

  it("forgets keys whose attempts have all aged out, so memory does not grow with the sources seen", () => {
    const window = new RateWindow(1, 1_000, 3);
    for (const key of ["a", "b", "c", "d"]) window.admit(key, 0);
    window.admit("e", 5_000);
    expect(window.size()).toBe(1);
  });
});

describe("the gate in front of the rooms", () => {
  it("has limits that a household behind one address and a host in a crash loop stay under", () => {
    // A host and each device retry at 1, 2, 4, 8, 16 then every 30 s: 6 attempts in the first minute and at most about
    // 130 an hour. A host with three devices, all failing, is 4 of them.
    expect(defaultSourceLimits.perMinute).toBeGreaterThanOrEqual(4 * 6);
    expect(defaultSourceLimits.perHour).toBeGreaterThanOrEqual(4 * 130);
  });

  it.effect("refuses a source over its minute limit and admits it when the minute has passed", () =>
    Effect.gen(function* () {
      const gate = new SourceGate({ perHour: 100, perMinute: 3 });
      for (let index = 0; index < 3; index++) expect(yield* gate.admit("1.2.3.4")).toBe(true);
      expect(yield* gate.admit("1.2.3.4")).toBe(false);
      expect(yield* gate.admit("5.6.7.8")).toBe(true);
      yield* TestClock.adjust(59_999);
      expect(yield* gate.admit("1.2.3.4")).toBe(false);
      yield* TestClock.adjust(1);
      expect(yield* gate.admit("1.2.3.4")).toBe(true);
    }),
  );

  it.effect("refuses a source over its hour limit although its minute is clear, and recovers after the hour", () =>
    Effect.gen(function* () {
      const gate = new SourceGate({ perHour: 4, perMinute: 3 });
      for (let index = 0; index < 3; index++) expect(yield* gate.admit("a")).toBe(true);
      yield* TestClock.adjust(60_000);
      expect(yield* gate.admit("a")).toBe(true);
      yield* TestClock.adjust(60_000);
      expect(yield* gate.admit("a")).toBe(false);
      yield* TestClock.adjust(3_600_000 - 120_000);
      expect(yield* gate.admit("a")).toBe(true);
    }),
  );
});

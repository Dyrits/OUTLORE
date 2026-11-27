import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import { isAntigravityLimitFor } from "../../src/harness/index.ts";
import { acpFakeEnv, acpFakeScript, readAcpFakeLog } from "../fixtures/acpFake.ts";
import { standInHarness } from "../fixtures/providerStandIns.ts";

// What `agy --print "/usage" --output-format json --print-timeout 10s` printed on the owner's computer on 2026-11-24
// (CLI 1.5.16, zero turns, zero tokens): the Gemini group has been used, the Claude and GPT group is untouched, so its
// buckets reset at the Unix epoch. The prose of `description` fields is shortened; the shape is the CLI's.
const usageAnswer = (overrides: { readonly status?: string; readonly groups?: unknown } = {}) =>
  JSON.stringify({
    command: {
      data: {
        description: "Within each group, models share a weekly limit and a 5-hour limit.",
        groups: overrides.groups ?? [
          {
            buckets: [
              {
                id: "gemini-weekly",
                name: "Weekly Limit Remaining",
                remaining_fraction: 0.6161444783210754,
                reset_time: "2026-12-01T14:38:31Z",
                window: "weekly",
              },
              {
                id: "gemini-5h",
                name: "Five Hour Limit Remaining",
                remaining_fraction: 0.9611419439315796,
                reset_time: "2026-11-25T12:42:47Z",
                window: "5h",
              },
            ],
            name: "Gemini Models",
          },
          {
            buckets: [
              {
                id: "3p-weekly",
                name: "Weekly Limit Remaining",
                remaining_fraction: 1,
                reset_time: "1970-01-01T00:00:00Z",
                window: "weekly",
              },
              {
                id: "3p-5h",
                name: "Five Hour Limit Remaining",
                remaining_fraction: 1,
                reset_time: "1970-01-01T00:00:00Z",
                window: "5h",
              },
            ],
            name: "Claude and GPT models",
          },
        ],
      },
      name: "usage",
    },
    conversation_id: "",
    duration_seconds: 0,
    num_turns: 0,
    response: "Gemini Models\tWeekly Limit Remaining\t62%\t2026-12-01T14:38:31Z\n",
    status: overrides.status ?? "SUCCESS",
    usage: { cache_read_tokens: 0, input_tokens: 0, output_tokens: 0, thinking_tokens: 0, total_tokens: 0 },
  });

describe("reading the Antigravity plan limits", () => {
  afterEach(() => vi.unstubAllEnvs());
  const directories: Array<string> = [];
  afterEach(() => {
    for (const directory of directories.splice(0))
      rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 });
  });

  /** The registry's Antigravity adapter over the stand-in, which prints `usageReport` for the `/usage` command. */
  const adapterOf = (usageReport: string | undefined) => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-antigravity-usage-"));
    directories.push(directory);
    const log = join(directory, "calls");
    vi.stubEnv("GEMINI_HOME", join(directory, "gemini-home"));
    const adapter = standInHarness("antigravity", {
      env: acpFakeEnv(log, {
        logEnv: ["GEMINI_HOME", "AGY_CLI_DISABLE_AUTO_UPDATE"],
        ...(usageReport === undefined ? {} : { usageReport }),
      }),
      idleTimeout: "10 minutes",
      prefixArgs: [acpFakeScript],
    });
    return { adapter, log };
  };

  it.live("reports the four limits of two model groups, each named by its group and window", () => {
    const { adapter } = adapterOf(usageAnswer());
    return Effect.gen(function* () {
      const harness = yield* adapter;
      const report = yield* harness.readPlanLimits("antigravity", null);
      expect(report).toEqual({
        billing: "Subscription",
        windows: [
          {
            label: "Gemini · Weekly",
            resetsAtSeconds: 1_796_135_911,
            usedPercent: 38.39,
            windowMinutes: 10_080,
          },
          { label: "Gemini · 5-hour", resetsAtSeconds: 1_795_610_567, usedPercent: 3.89, windowMinutes: 300 },
          // An untouched bucket resets at the Unix epoch: nothing has started counting, so it reads as unused.
          { label: "Others · Weekly", resetsAtSeconds: 0, usedPercent: 0, windowMinutes: 10_080 },
          { label: "Others · 5-hour", resetsAtSeconds: 0, usedPercent: 0, windowMinutes: 300 },
        ],
      });
    });
  });

  it.live("asks the CLI's own usage command on the pinned home and spends nothing", () => {
    const { adapter, log } = adapterOf(usageAnswer());
    return Effect.gen(function* () {
      const harness = yield* adapter;
      yield* harness.readPlanLimits("antigravity", null);
      const launch = readAcpFakeLog(log).find((entry) => entry.launch !== undefined)?.launch;
      expect(launch?.argv).toEqual(["--print", "/usage", "--output-format", "json", "--print-timeout", "10s"]);
      expect(launch?.env.AGY_CLI_DISABLE_AUTO_UPDATE).toBe("true");
      expect(launch?.env.GEMINI_HOME).toContain("gemini-home");
    });
  });

  it.live("reports no limits for an added account, whose sign-in the CLI does not take yet", () => {
    const { adapter, log } = adapterOf(usageAnswer());
    return Effect.gen(function* () {
      const harness = yield* adapter;
      expect(yield* harness.readPlanLimits("antigravity", "/accounts/work")).toBeNull();
      expect(readAcpFakeLog(log)).toEqual([]);
    });
  });

  it.live("fails, so the caller waits and keeps the last reading, when the command fails or answers an error", () => {
    const failing = adapterOf(undefined);
    const refused = adapterOf(usageAnswer({ status: "ERROR" }));
    const garbled = adapterOf("this is not json");
    return Effect.gen(function* () {
      for (const { adapter } of [failing, refused, garbled]) {
        const harness = yield* adapter;
        const outcome = yield* Effect.flip(harness.readPlanLimits("antigravity", null));
        expect(outcome._tag).toBe("HarnessFailure");
      }
    });
  });

  it.live("reports no limits when the CLI lists no groups, and skips a bucket it cannot read", () => {
    const none = adapterOf(usageAnswer({ groups: [] }));
    const partial = adapterOf(
      usageAnswer({
        groups: [
          {
            buckets: [
              { remaining_fraction: 0.5, reset_time: "2026-12-01T00:00:00Z", window: "monthly-ish" },
              { remaining_fraction: "x", reset_time: "2026-12-01T00:00:00Z", window: "5h" },
              { remaining_fraction: 0.25, reset_time: "2026-12-01T00:00:00Z", window: "5h" },
            ],
            name: "Gemini Models",
          },
        ],
      }),
    );
    return Effect.gen(function* () {
      expect(yield* (yield* none.adapter).readPlanLimits("antigravity", null)).toBeNull();
      const report = yield* (yield* partial.adapter).readPlanLimits("antigravity", null);
      expect(report?.windows).toEqual([
        { label: "Gemini · 5-hour", resetsAtSeconds: 1_796_083_200, usedPercent: 75, windowMinutes: 300 },
      ]);
    });
  });
});

describe("which limits apply to a model", () => {
  it("binds a Gemini model to the Gemini limits, any other model to Others, and any model to an ungrouped limit", () => {
    expect(isAntigravityLimitFor("Gemini · Weekly", "gemini-4-neon-medium")).toBe(true);
    expect(isAntigravityLimitFor("Others · Weekly", "gemini-4-neon-medium")).toBe(false);
    expect(isAntigravityLimitFor("Others · Weekly", "claude-opus-5-5")).toBe(true);
    expect(isAntigravityLimitFor("Gemini · 5-hour", "gpt-5")).toBe(false);
    expect(isAntigravityLimitFor("Weekly", "gemini-4-neon-medium")).toBe(true);
    expect(isAntigravityLimitFor("Weekly", "claude-opus-5-5")).toBe(true);
  });
});

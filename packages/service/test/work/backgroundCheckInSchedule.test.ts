import { expect, it } from "@effect/vitest";
import { WorkspaceId } from "@outlore/contracts";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { readSettings, storeLayer, writeSettings } from "../../src/core/index.ts";
import { runDueBackgroundCheckIn } from "../../src/work/backgroundCheckInSchedule.ts";

it.effect("admits one check-in per local day and reads the current settings before admission", () => {
  const start = new Date(2026, 10, 22, 8, 59, 59, 999).getTime();
  const tomorrow = new Date(2026, 10, 23, 9).getTime();
  const nextDay = new Date(2026, 10, 24, 9).getTime();
  return Effect.gen(function* () {
    const settings = yield* writeSettings({
      ...(yield* readSettings),
      backgroundCheckIns: {
        companion: { accountId: null, effort: "default", harness: "opencode", model: "local/first" },
        isEnabled: true,
        paidFallback: null,
        realmIds: [WorkspaceId.make("realm-one")],
        time: "09:00",
      },
    });
    const config = settings.backgroundCheckIns;
    if (config == null) return yield* Effect.die("Missing check-in settings");
    const seen: string[] = [];
    const sweep = runDueBackgroundCheckIn((current) =>
      Effect.sync(() => {
        seen.push(current.companion.model);
      }),
    );

    yield* TestClock.setTime(start);
    yield* sweep;
    expect(seen).toEqual([]);

    yield* TestClock.adjust(1);
    yield* Effect.all([sweep, sweep], { concurrency: 2 });
    expect(seen).toEqual(["local/first"]);

    yield* writeSettings({ ...settings, backgroundCheckIns: { ...config, time: "10:00" } });
    yield* TestClock.setTime(new Date(2026, 10, 22, 10).getTime());
    yield* sweep;
    expect(seen).toEqual(["local/first"]);

    yield* writeSettings({ ...settings, backgroundCheckIns: { ...config, isEnabled: false } });
    yield* TestClock.setTime(tomorrow);
    yield* sweep;
    expect(seen).toEqual(["local/first"]);

    yield* writeSettings({
      ...settings,
      backgroundCheckIns: { ...config, companion: { ...config.companion, model: "local/second" } },
    });
    yield* TestClock.setTime(nextDay);
    yield* sweep;
    expect(seen).toEqual(["local/first", "local/second"]);
  }).pipe(Effect.provide(storeLayer(":memory:")));
});

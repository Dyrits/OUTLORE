import { describe, expect, it } from "vitest";
import { currentWindowsOf, leftPercentOf, planUsageOf, resetsInTextOf } from "../../src/editors/planUsage";

const hour = 3_600_000;
const now = 1_000_000_000_000;
const fiveHour = { label: "5-hour", resetsAt: now + 2 * hour, usedPercent: 4, windowMinutes: 300 };
const weekly = { label: "Weekly", resetsAt: now + 100 * hour, usedPercent: 38, windowMinutes: 10_080 };

describe("a plan's usage as the popup's table", () => {
  it("makes one row per limit with what is left and when it starts over", () => {
    const { groups } = planUsageOf([fiveHour, weekly], now);
    expect(groups).toEqual([
      {
        name: null,
        rows: [
          { leftPercent: 96, level: "normal", name: "5-hour", resetText: "2h 0m" },
          { leftPercent: 62, level: "normal", name: "Weekly", resetText: "4d 4h" },
        ],
      },
    ]);
  });

  it("groups limits named 'group · window' by their model group, in the order the harness gave them", () => {
    const { groups } = planUsageOf(
      [
        { ...fiveHour, label: "Gemini · 5-hour" },
        { ...weekly, label: "Gemini · Weekly" },
        { ...fiveHour, label: "Others · 5-hour", usedPercent: 50 },
        { ...weekly, label: "Others · Weekly", usedPercent: 10 },
      ],
      now,
    );
    expect(groups.map((group) => group.name)).toEqual(["Gemini", "Others"]);
    expect(groups.map((group) => group.rows.map((row) => row.name))).toEqual([
      ["5-hour", "Weekly"],
      ["5-hour", "Weekly"],
    ]);
    expect(groups[1]?.rows.map((row) => row.leftPercent)).toEqual([50, 90]);
  });

  it("lists the shorter window first inside a group", () => {
    const { groups } = planUsageOf([weekly, fiveHour], now);
    expect(groups[0]?.rows.map((row) => row.name)).toEqual(["5-hour", "Weekly"]);
  });

  it("says 'not started' for a limit with no reset time, never a date in 1970", () => {
    const { groups } = planUsageOf([{ label: "Gemini · Weekly", resetsAt: 0, usedPercent: 0 }], now);
    expect(groups[0]?.rows[0]).toEqual({
      leftPercent: 100,
      level: "unstarted",
      name: "Weekly",
      resetText: "not started",
    });
  });

  it("reads a limit whose reset has passed as unused and reset", () => {
    const { groups } = planUsageOf([{ ...fiveHour, resetsAt: now - 1, usedPercent: 90 }], now);
    expect(groups[0]?.rows[0]).toEqual({ leftPercent: 100, level: "normal", name: "5-hour", resetText: "reset" });
  });

  it("colors each row: normal, warning from 80% used, reached at 100%", () => {
    const { groups } = planUsageOf(
      [50, 80, 100].map((usedPercent) => ({ ...weekly, label: `W${usedPercent}`, usedPercent })),
      now,
    );
    expect(groups[0]?.rows.map((row) => row.level)).toEqual(["normal", "warning", "reached"]);
  });
});

describe("a provider's one dot", () => {
  it("takes the tightest limit's state", () => {
    expect(planUsageOf([fiveHour, weekly], now).level).toBe("normal");
    expect(planUsageOf([fiveHour, { ...weekly, usedPercent: 85 }], now).level).toBe("warning");
    expect(
      planUsageOf(
        [
          { ...fiveHour, usedPercent: 100 },
          { ...weekly, usedPercent: 85 },
        ],
        now,
      ).level,
    ).toBe("reached");
  });

  it("ignores limits that have not started, and is normal when none has", () => {
    const untouched = { label: "Others · Weekly", resetsAt: 0, usedPercent: 0 };
    expect(planUsageOf([untouched, fiveHour], now).level).toBe("normal");
    expect(planUsageOf([untouched], now).level).toBe("normal");
  });

  it("is neutral when no limit is known", () => {
    expect(planUsageOf([], now)).toEqual({ groups: [], level: "neutral" });
  });
});

describe("windows that have reset", () => {
  it("read as unused once their reset time has passed, and are kept otherwise", () => {
    const [soon, later] = currentWindowsOf(
      [
        { label: "5-hour", resetsAt: 1_000, usedPercent: 60 },
        { label: "Weekly", resetsAt: 9_000, usedPercent: 40 },
      ],
      5_000,
    );
    expect(soon?.usedPercent).toBe(0);
    expect(later?.usedPercent).toBe(40);
  });

  it("keeps a limit that has not started as it is", () => {
    const [untouched] = currentWindowsOf([{ label: "Weekly", resetsAt: 0, usedPercent: 0 }], 5_000);
    expect(untouched?.resetsAt).toBe(0);
  });
});

describe("the popup's figures", () => {
  it("writes the time to a reset in its two largest units", () => {
    expect(resetsInTextOf(4 * hour + 57 * 60_000)).toBe("4h 57m");
    expect(resetsInTextOf(6 * 24 * hour + 9 * hour + 5_000)).toBe("6d 9h");
    expect(resetsInTextOf(90_000)).toBe("1m");
    expect(resetsInTextOf(10_000)).toBe("1m");
    expect(resetsInTextOf(0)).toBe("reset");
    expect(resetsInTextOf(-5)).toBe("reset");
  });

  it("gives the share left, kept between 0 and 100", () => {
    expect(leftPercentOf({ ...weekly, usedPercent: 11 })).toBe(89);
    expect(leftPercentOf({ ...weekly, usedPercent: 140 })).toBe(0);
    expect(leftPercentOf({ ...weekly, usedPercent: -3 })).toBe(100);
  });
});

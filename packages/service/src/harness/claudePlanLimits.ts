import { tmpdir } from "node:os";
import type { BillingKind } from "@outlore/contracts";
import { Effect } from "effect";
import {
  fieldOf,
  HarnessFailure,
  type PlanLimitReport,
  type PlanLimitsReport,
  runShortCommand,
  textFieldOf,
} from "../core/index.ts";
import { hasKeyEnvironment } from "./accountKeys.ts";
import { billingOf } from "./claudeEvents.ts";
import { accountEnvironmentOf } from "./harnessCatalog.ts";

// Plan-limit parsing and one-shot probing for Claude Code (probe of 2026-11-12, Claude Code 2.1.322).

/** The plan windows Claude Code reports in a `rate_limit_event`, by name, with their length in minutes. */
const planWindows = [
  { minutes: 300, name: "five_hour" },
  { minutes: 10_080, name: "seven_day" },
] as const;

/** The arguments of the smallest turn that makes Claude Code report the plan's limits: one word to its cheapest model. */
const probeArgs = [
  "-p",
  "ok",
  "--output-format",
  "stream-json",
  "--verbose",
  "--max-turns",
  "1",
  "--model",
  "haiku",
  "--tools",
  "",
  "--no-session-persistence",
  "--setting-sources",
  "",
  "--disable-slash-commands",
  "--strict-mcp-config",
];

/**
 * The plan limits a `rate_limit_event` carries (probe of 2026-11-12, Claude Code 2.1.322): `unifiedWindows` holds the 5-hour and weekly windows, each with `utilization` (0 to 1) and `resetsAt` (seconds).
 * Null when the event has none.
 */
export const planLimitsOf = (event: unknown, billing: BillingKind): PlanLimitsReport | null => {
  const windows = fieldOf(fieldOf(event, "rate_limit_info"), "unifiedWindows");
  if (typeof windows !== "object" || windows === null) return null;
  const reported = planWindows.flatMap(({ minutes, name }): Array<PlanLimitReport> => {
    const window = fieldOf(windows, name);
    const utilization = fieldOf(window, "utilization");
    const resetsAt = fieldOf(window, "resetsAt");
    return typeof utilization === "number" && typeof resetsAt === "number"
      ? [
          {
            resetsAtSeconds: resetsAt,
            usedPercent: Math.round(utilization * 1000) / 10,
            windowMinutes: minutes,
          },
        ]
      : [];
  });
  return reported.length === 0 ? null : { billing, windows: reported };
};

/**
 * Asks Claude Code for an account's plan limits with one minimal turn in an empty folder: the stream's `rate_limit_event` answers.
 * Null when it reports none; no token or credential is read here.
 */
export const probeClaudePlanLimits = Effect.fnUntraced(function* (
  options: { readonly command: string; readonly prefixArgs?: ReadonlyArray<string> },
  configDirectory: string | null,
) {
  // An API key account has no plan: the probe is a real turn, which would be billed to the key for nothing.
  if (configDirectory !== null && hasKeyEnvironment(configDirectory))
    return { billing: "ApiKey", windows: [] } satisfies PlanLimitsReport;
  const run = yield* runShortCommand(
    options.command,
    [...(options.prefixArgs ?? []), ...probeArgs],
    accountEnvironmentOf("claude", configDirectory),
    60_000,
    tmpdir(),
  );
  let billing: BillingKind = "Unknown";
  let report: PlanLimitsReport | null = null;
  for (const line of run.stdout.split("\n")) {
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (textFieldOf(event, "type") === "system" && textFieldOf(event, "subtype") === "init")
      billing = billingOf(event, billing);
    else if (textFieldOf(event, "type") === "rate_limit_event") report = planLimitsOf(event, billing) ?? report;
  }
  if (report === null && run.code !== 0)
    return yield* new HarnessFailure({ reason: "Claude Code gave no plan limits." });
  return billing === "ApiKey" ? ({ billing, windows: [] } satisfies PlanLimitsReport) : report;
});

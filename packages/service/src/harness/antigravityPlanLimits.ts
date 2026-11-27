import { tmpdir } from "node:os";
import { Effect } from "effect";
import {
  fieldOf,
  HarnessFailure,
  type PlanLimitReport,
  type PlanLimitsReport,
  runShortCommand,
  textFieldOf,
} from "../core/index.ts";

// The plan limits of Antigravity, read from the CLI's own `/usage` command (ADR 0008, Comply with provider terms):
// `agy --print "/usage" --output-format json --print-timeout 10s` answers locally with `num_turns: 0` and zero tokens
// (verified live on CLI 1.5.16, 2026-11-24), so no model is called and no token file is read.

/** The windows Antigravity names, with the name the owner reads and the length in minutes. */
const windows: Readonly<Record<string, { readonly label: string; readonly minutes: number }>> = {
  "5h": { label: "5-hour", minutes: 300 },
  weekly: { label: "Weekly", minutes: 10_080 },
};

/**
 * The group of a model, or of the name the CLI gives a group: the Gemini models, and every other model (the CLI names the latter "Claude and GPT models").
 * A limit is labelled with it, and a Companion is refused only by the limits of its own group.
 */
export const antigravityGroupOf = (name: string) => (/^gemini/i.test(name) ? "Gemini" : "Others");

/** The separator between a limit's group and its window in a label. */
const groupSeparator = " · ";

/** The label of a limit of a group and window, such as "Gemini · Weekly". */
const limitLabelOf = (group: string, window: string) => `${group}${groupSeparator}${window}`;

/** Whether a limit applies to a model: a grouped limit applies only to models of its group, and a limit with no group applies to every model. */
export const antigravityLimitAppliesTo = (label: string, model: string) => {
  const separator = label.indexOf(groupSeparator);
  return separator === -1 || label.slice(0, separator) === antigravityGroupOf(model);
};

/** The CLI's reset time of a bucket that has not started counting: the Unix epoch. It reads as 0 seconds. */
const untouchedResetSeconds = 0;

/** A used share from a remaining fraction, in percent to two places; kept inside 0 to 100. */
const usedPercentOf = (remainingFraction: number) =>
  Math.round(Math.min(1, Math.max(0, 1 - remainingFraction)) * 10_000) / 100;

/**
 * The limits in one `/usage` answer (CLI 1.5.16): `command.data.groups` holds the model groups, each with a `name` and
 * `buckets` of a `window` (`5h` or `weekly`), a `remaining_fraction` from 0 to 1, and a `reset_time`. Each limit is named
 * by its group (Gemini or Others) and window, because two groups report the same two windows. A bucket it cannot read is skipped; null when
 * none can be read.
 */
export const antigravityPlanLimitsOf = (answer: unknown): PlanLimitsReport | null => {
  const groups = fieldOf(fieldOf(fieldOf(answer, "command"), "data"), "groups");
  if (!Array.isArray(groups)) return null;
  const limits = groups.flatMap((group): Array<PlanLimitReport> => {
    const name = textFieldOf(group, "name");
    const buckets = fieldOf(group, "buckets");
    if (name === null || !Array.isArray(buckets)) return [];
    return buckets.flatMap((bucket): Array<PlanLimitReport> => {
      const window = windows[textFieldOf(bucket, "window") ?? ""];
      const remaining = fieldOf(bucket, "remaining_fraction");
      const resetAt = textFieldOf(bucket, "reset_time");
      const resetsAtMillis = resetAt === null ? Number.NaN : Date.parse(resetAt);
      if (window === undefined || typeof remaining !== "number" || Number.isNaN(resetsAtMillis)) return [];
      return [
        {
          label: limitLabelOf(antigravityGroupOf(name), window.label),
          resetsAtSeconds: resetsAtMillis <= 0 ? untouchedResetSeconds : resetsAtMillis / 1000,
          usedPercent: usedPercentOf(remaining),
          windowMinutes: window.minutes,
        },
      ];
    });
  });
  return limits.length === 0 ? null : { billing: "Subscription", windows: limits };
};

/** How the plan limits are read: the executable, its prefix arguments (a stand-in script in checks), and the launch's environment. */
export type AntigravityUsageOptions = {
  readonly command: string;
  readonly env: Readonly<Record<string, string>>;
  readonly prefixArgs?: ReadonlyArray<string>;
};

/**
 * Asks the CLI for the limits of the computer's own sign-in, on the launch's environment so it reads the home a turn uses.
 * Null when it lists none; a failure when the command fails, answers something other than SUCCESS, or prints no JSON.
 */
export const readAntigravityPlanLimits = (options: AntigravityUsageOptions) =>
  runShortCommand(
    options.command,
    [...(options.prefixArgs ?? []), "--print", "/usage", "--output-format", "json", "--print-timeout", "10s"],
    { ...options.env },
    20_000,
    tmpdir(),
  ).pipe(
    Effect.flatMap(({ code, stdout }) => {
      const failure = (reason: string) => Effect.fail(new HarnessFailure({ reason }));
      if (code !== 0) return failure("Antigravity gave no plan limits: its usage command failed.");
      let answer: unknown;
      try {
        answer = JSON.parse(stdout);
      } catch {
        return failure("Antigravity gave no plan limits: its usage command printed no JSON.");
      }
      if (textFieldOf(answer, "status") !== "SUCCESS")
        return failure("Antigravity gave no plan limits: its usage command did not succeed.");
      return Effect.succeed(antigravityPlanLimitsOf(answer));
    }),
  );

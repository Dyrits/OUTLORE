import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { Effect } from "effect";
import {
  fieldOf,
  HarnessFailure,
  numberFieldOf,
  type PlanLimitReport,
  type PlanLimitsReport,
  reducedEnvironmentOf,
} from "../core/index.ts";
import { accountEnvironmentOf } from "./harnessCatalog.ts";
import type { OpenCodeOptions } from "./opencode.ts";

// The plan limits of OpenCode Go, read from the `opencode serve` of an account (ADR 0008; probe of 2026-11-12).

/** OpenCode Go's three windows in the order its usage report names them, with their length in minutes. */
const goWindows = [
  { minutes: 300, name: "rolling" },
  { minutes: 10080, name: "weekly" },
  { minutes: 43200, name: "monthly" },
] as const;

/**
 * The plan limits in OpenCode's `usage.limits` answer (probe of 2026-11-12, OpenCode 2.2.0): `data.go` holds the
 * OpenCode Go allowance as a 5-hour `rolling`, a `weekly`, and a `monthly` window, each with `percent` used and `resetsAt`
 * in milliseconds. Null when the sign-in has no Go plan, or OpenCode is not signed in to its Console (`data` is null).
 */
export const openCodePlanLimitsOf = (body: unknown): PlanLimitsReport | null => {
  const go = fieldOf(fieldOf(body, "data"), "go");
  const windows = goWindows.flatMap(({ minutes, name }): Array<PlanLimitReport> => {
    const window = fieldOf(go, name);
    return typeof fieldOf(window, "percent") === "number"
      ? [
          {
            resetsAtSeconds: numberFieldOf(window, "resetsAt") / 1000,
            usedPercent: numberFieldOf(window, "percent"),
            windowMinutes: minutes,
          },
        ]
      : [];
  });
  return windows.length === 0 ? null : { billing: "Subscription", windows };
};

/**
 * Asks OpenCode for the limits of the Go plan behind an account: a short `opencode serve` on a free local port, in the
 * account's own data folder and behind a password made for this one run, answers its `usage/limits` route with the
 * Console workspace OpenCode itself is signed in to, and is closed again. Outlore reads no token (requirements, Comply
 * with provider terms). Null when OpenCode reports no Go plan; a failure when it could not answer.
 */
export const readOpenCodePlanLimits = (
  options: Pick<OpenCodeOptions, "command" | "prefixArgs">,
  configDirectory: string | null,
) =>
  Effect.tryPromise({
    catch: (error) => new HarnessFailure({ reason: `OpenCode gave no plan limits: ${String(error)}` }),
    try: async () => {
      const password = randomUUID();
      const child = spawn(
        options.command,
        [...(options.prefixArgs ?? []), "serve", "--hostname", "127.0.0.1", "--port", "0"],
        {
          cwd: tmpdir(),
          env: reducedEnvironmentOf({
            ...accountEnvironmentOf("opencode", configDirectory),
            OPENCODE_SERVER_PASSWORD: password,
          }),
          stdio: ["ignore", "pipe", "ignore"],
        },
      );
      try {
        const address = await new Promise<string>((resolve, reject) => {
          let printed = "";
          const timer = setTimeout(() => reject(new Error("it did not start in time")), 15_000);
          child.on("error", (error) => reject(error));
          child.on("exit", () => reject(new Error("it stopped before it was ready")));
          child.stdout.on("data", (chunk: Buffer) => {
            printed += chunk.toString();
            const found = /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(printed);
            if (found?.[1] === undefined) return;
            clearTimeout(timer);
            resolve(found[1]);
          });
        });
        const answer = await fetch(`${address}/api/experimental/usage/limits`, {
          headers: { authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` },
          signal: AbortSignal.timeout(20_000),
        });
        if (!answer.ok) throw new Error(`it answered ${answer.status}`);
        return openCodePlanLimitsOf(await answer.json());
      } finally {
        child.kill();
      }
    },
  });

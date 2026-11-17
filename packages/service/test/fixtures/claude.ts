import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Duration } from "effect";
import { afterEach } from "vitest";
import { claudeHarnessLayer, serviceLayer } from "../../src/index.ts";
import { temporary } from "./service.ts";

/** The Claude Code stand-in script the tests run in place of the installed claude. */
export const standIn = join(import.meta.dirname, "stand-in-claude.mjs");

/** A stand-in reply without the turn's note (journal, lore, budget) that precedes the messages. */
export const withoutNote = (text: string | undefined) => text?.replace(/ to: [\s\S]*?\n---\n\n/, " to: ") ?? "";

afterEach(() => {
  delete process.env.STAND_IN_MODE;
  delete process.env.STAND_IN_COST;
  delete process.env.STAND_IN_API_KEY_SOURCE;
  delete process.env.STAND_IN_MCP_STATUS;
  delete process.env.STAND_IN_MODEL;
  delete process.env.STAND_IN_INPUT;
});

/** A service whose Claude Code adapter runs the stand-in on the current runtime. */
export const withClaude = (options: { idleTimeout?: Duration.Input; sandboxProblem?: string } = {}) => {
  const directory = temporary("outlore-claude-");
  const log = join(directory, "starts.jsonl");
  process.env.STAND_IN_LOG = log;
  const layer = serviceLayer({
    filename: join(directory, "outlore.sqlite"),
    harness: claudeHarnessLayer({
      command: process.execPath,
      idleTimeout: options.idleTimeout ?? "10 minutes",
      prefixArgs: [standIn],
      sandboxProblem: options.sandboxProblem ?? null,
      userSettingsPath: join(directory, "no-settings.json"),
    }),
    homeFolder: directory,
    scratchRoot: join(directory, "missions"),
  });
  const starts = (): Array<{ pid: number; args: string[]; cwd: string; env: string[] }> => {
    try {
      return readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  };
  return { directory, layer, starts };
};

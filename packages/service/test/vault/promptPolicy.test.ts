import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { isInsideVaultFolder } from "../../src/vault/index.ts";
import { Approvals } from "../../src/work/index.ts";
import { ask, databaseFile, isAsking, push, serviceOn, settle, start } from "../fixtures/approvals.ts";
import { temporary } from "../fixtures/service.ts";

describe("telling whether a path lies in the Vault's folder", () => {
  const root = temporary("outlore-path-");
  const folder = join(root, "vault");
  mkdirSync(folder);
  writeFileSync(join(folder, "header.json"), "{}");
  symlinkSync(folder, join(root, "shortcut"));

  it("counts the folder, a file in it, a path through `..`, and a link to it", () => {
    for (const path of [
      folder,
      join(folder, "header.json"),
      join(root, "x", "..", "vault", "records"),
      join(root, "shortcut", "header.json"),
    ])
      expect(isInsideVaultFolder(folder, path, "/")).toBe(true);
  });

  it("counts a relative path from the folder it is relative to, and a file that does not exist yet", () => {
    expect(isInsideVaultFolder(folder, "vault/header.json", root)).toBe(true);
    expect(isInsideVaultFolder(folder, "vault/not-yet", root)).toBe(true);
  });

  it("does not count a sibling whose name starts the same, or the folder's parent", () => {
    expect(isInsideVaultFolder(folder, join(root, "vault-notes"), "/")).toBe(false);
    expect(isInsideVaultFolder(folder, root, "/")).toBe(false);
  });
});

describe("refusing Claude Code's own file reads of the Vault's folder", () => {
  it.live(
    "refuses Read, Grep and Glob that name a path in it, whatever the level, and still allows other actions",
    () => {
      const filename = databaseFile();
      const vault = join(dirname(filename), "vault");
      return Effect.gen(function* () {
        const started = yield* start(ask(push));
        yield* settle(started.missionId, isAsking);
        const approvals = yield* Approvals;
        const prompt = (toolName: string, input: object) =>
          approvals.answerPrompt(started.threadId, { input, toolName });
        for (const [toolName, input] of [
          ["Read", { file_path: join(vault, "header.json") }],
          ["Grep", { path: vault, pattern: "x" }],
          ["Glob", { path: vault, pattern: "*" }],
          ["Glob", { pattern: join(vault, "*") }],
          ["Read", { file_path: join(vault, "..", "vault", "records-x.json") }],
        ] as const) {
          const answer = yield* prompt(toolName, input);
          expect(answer).toEqual({ isAllowed: false, text: "The Vault's folder is closed to threads." });
        }
        // Control: the same prompt path with an action outside the folder is not refused for the Vault.
        expect((yield* prompt("Bash", { command: "ls" })).isAllowed).toBe(true);
      }).pipe(Effect.provide(serviceOn(filename)));
    },
  );
});

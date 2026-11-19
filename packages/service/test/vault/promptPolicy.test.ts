import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { isInsideVaultFolder, searchReachesVaultFolder } from "../../src/vault/index.ts";
import { Approvals } from "../../src/work/index.ts";
import { ask, databaseFile, isAsking, push, serviceOn, settle, start } from "../fixtures/approvals.ts";
import { temporary } from "../fixtures/service.ts";

describe("telling whether a path lies in the Vault's folder", () => {
  const root = temporary("outlore-path-");
  const folder = join(root, "vault");
  mkdirSync(folder);
  writeFileSync(join(folder, "header.json"), "{}");
  symlinkSync(folder, join(root, "shortcut"));

  /** A folder with a link above it, made afresh for one test (the describe's own fixtures go at the first test's end). */
  const linkedRootOf = () => {
    const own = temporary("outlore-search-");
    const ownFolder = join(own, "vault");
    mkdirSync(ownFolder);
    symlinkSync(own, join(own, "data-link"));
    return { folder: ownFolder, linkUp: join(own, "data-link"), root: own };
  };

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

  it("counts a search rooted at the folder, above it, at the root of the disk, or through a link above it", () => {
    const { folder: ownFolder, linkUp, root: ownRoot } = linkedRootOf();
    for (const searchRoot of [ownFolder, ownRoot, "/", linkUp, join(ownRoot, "a", "..")])
      expect(searchReachesVaultFolder(ownFolder, searchRoot, "/")).toBe(true);
  });

  it("counts a search whose root is a relative climb into an ancestor of the folder", () => {
    const { folder: ownFolder, root: ownRoot } = linkedRootOf();
    expect(searchReachesVaultFolder(ownFolder, "..", join(ownRoot, "work"))).toBe(true);
    expect(searchReachesVaultFolder(ownFolder, "../..", join(ownRoot, "work", "one"))).toBe(true);
  });

  it("does not count a search rooted beside the folder, or under it", () => {
    const { folder: ownFolder, root: ownRoot } = linkedRootOf();
    expect(searchReachesVaultFolder(ownFolder, join(ownRoot, "missions"), "/")).toBe(false);
    expect(searchReachesVaultFolder(ownFolder, join(ownFolder, "records"), "/")).toBe(false);
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

  it.live(
    "refuses a Grep or Glob whose search would walk into the folder from above, and allows searches that cannot",
    () => {
      const filename = databaseFile();
      const dataDirectory = dirname(filename);
      const linkUp = join(dataDirectory, "missions", "link-up");
      mkdirSync(join(dataDirectory, "missions"), { recursive: true });
      symlinkSync(dataDirectory, linkUp);
      return Effect.gen(function* () {
        const started = yield* start(ask(push));
        yield* settle(started.missionId, isAsking);
        const approvals = yield* Approvals;
        const prompt = (toolName: string, input: object) =>
          approvals.answerPrompt(started.threadId, { input, toolName });
        // The parent that holds the Vault's folder, the disk's root, and a link that climbs to the parent: a search
        // rooted at any of them walks into the folder, even though none names a path inside it.
        for (const [toolName, input] of [
          ["Grep", { path: dataDirectory, pattern: "header" }],
          ["Grep", { path: "/", pattern: "header" }],
          ["Glob", { path: dataDirectory, pattern: "**/*.json" }],
          ["Grep", { path: linkUp, pattern: "header" }],
        ] as const) {
          const answer = yield* prompt(toolName, input);
          expect(answer).toEqual({ isAllowed: false, text: "The Vault's folder is closed to threads." });
        }
        // Controls: a search of a folder beside the Vault's, and one with no root of its own (the thread's folder),
        // stay allowed, so the refusal costs nothing an ordinary search needs.
        expect((yield* prompt("Grep", { path: join(dataDirectory, "missions"), pattern: "x" })).isAllowed).toBe(true);
        expect((yield* prompt("Glob", { pattern: "*.ts" })).isAllowed).toBe(true);
      }).pipe(Effect.provide(serviceOn(filename)));
    },
  );
});

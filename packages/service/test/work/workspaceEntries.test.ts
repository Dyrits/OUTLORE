import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { call } from "../fixtures/service.ts";
import { failureOf, setUp } from "../fixtures/workspaces.ts";

describe("naming files and folders of a workspace with @", () => {
  const entries = (workspacePath: string, query: string) =>
    call({ _tag: "ListWorkspaceEntries", query, workspacePath }).pipe(
      Effect.map((found) => found.map((entry) => entry.path)),
    );

  it.live("lists the top level first, then matches a name or a path, folders ending with a slash", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      const app = join(home, "app");
      mkdirSync(join(app, "src", "deep"), { recursive: true });
      mkdirSync(join(app, "node_modules", "left-pad"), { recursive: true });
      writeFileSync(join(app, "README.md"), "");
      writeFileSync(join(app, "src", "index.ts"), "");
      writeFileSync(join(app, "src", "deep", "readme-notes.md"), "");
      writeFileSync(join(app, "node_modules", "left-pad", "index.js"), "");
      expect(yield* entries(app, "")).toEqual(["src/", "README.md"]);
      expect(yield* entries(app, "read")).toEqual(["README.md", "src/deep/readme-notes.md"]);
      expect(yield* entries(app, "src/d")).toEqual(["src/deep/", "src/deep/readme-notes.md"]);
      expect(yield* entries(app, "index")).toEqual(["src/index.ts"]);
      // A name starting with the query comes before a shorter path that only contains it.
      mkdirSync(join(app, "deeper", "folder"), { recursive: true });
      mkdirSync(join(app, "a"), { recursive: true });
      writeFileSync(join(app, "deeper", "folder", "note.txt"), "");
      writeFileSync(join(app, "a", "xnote.txt"), "");
      expect(yield* entries(app, "note")).toEqual([
        "deeper/folder/note.txt",
        "a/xnote.txt",
        "src/deep/readme-notes.md",
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("follows .gitignore in a git workspace", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      const app = join(home, "app");
      execFileSync("git", ["init", "-q"], { cwd: app });
      writeFileSync(join(app, ".gitignore"), "secret.txt\ndist/\n");
      mkdirSync(join(app, "dist"));
      writeFileSync(join(app, "dist", "out.js"), "");
      writeFileSync(join(app, "secret.txt"), "");
      writeFileSync(join(app, "notes.txt"), "");
      expect(yield* entries(app, "")).toEqual([".gitignore", "notes.txt"]);
      expect(yield* entries(app, "secret")).toEqual([]);
      expect(yield* entries(app, "out")).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses a path that is not a folder", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      writeFileSync(join(home, "file.txt"), "");
      const refusal = yield* failureOf({
        _tag: "ListWorkspaceEntries",
        query: "",
        workspacePath: join(home, "file.txt"),
      });
      expect(JSON.stringify(refusal)).toContain("No folder");
    }).pipe(Effect.provide(layer));
  });
});

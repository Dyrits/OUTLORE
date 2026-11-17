import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { seedBrowsableRoots } from "../../src/core/folders.ts";
import { searchFolders } from "../../src/core/index.ts";
import { migrations } from "../../src/core/store.ts";

// Searching folders (device-pairing): a typed path's completions leave out what a search by name leaves out.

const directories: Array<string> = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

/** A home folder holding ordinary folders, dependency and build folders, and hidden folders, as the only root. */
const setUp = () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "outlore-search-")));
  directories.push(directory);
  const home = join(directory, "home");
  for (const name of ["app", "apple", "node_modules", "dist", "build", "out", "target", "coverage", "__pycache__"]) {
    mkdirSync(join(home, name), { recursive: true });
  }
  for (const name of [".hidden", ".config"]) mkdirSync(join(home, name), { recursive: true });
  const layer = SqliteClient.layer({ filename: join(directory, "store.sqlite") });
  const search = (query: string) =>
    Effect.gen(function* () {
      yield* SqliteMigrator.run({ loader: SqliteMigrator.fromRecord(migrations) });
      yield* seedBrowsableRoots(home);
      return (yield* searchFolders(query, "roots", home)).map((folder) => folder.path);
    }).pipe(Effect.provide(layer));
  return { home, search };
};

describe("completing a typed path", () => {
  it.effect("offers ordinary subfolders and none of the dependency and build folders a name search skips", () => {
    const { home, search } = setUp();
    return Effect.gen(function* () {
      expect(yield* search(`${home}/`)).toEqual([join(home, "app"), join(home, "apple")]);
    });
  });

  it.effect("does not complete a prefix into a skipped folder", () => {
    const { home, search } = setUp();
    return Effect.gen(function* () {
      for (const prefix of ["n", "di", "bu", "ou", "ta", "co", "__"]) {
        expect(yield* search(`${home}/${prefix}`), prefix).toEqual([]);
      }
    });
  });

  it.effect("still resolves a skipped folder typed in full", () => {
    const { home, search } = setUp();
    return Effect.gen(function* () {
      expect(yield* search(join(home, "node_modules"))).toEqual([join(home, "node_modules")]);
      expect(yield* search(join(home, "dist"))).toEqual([join(home, "dist")]);
    });
  });

  it.effect("offers hidden folders only when the typed part starts with a dot", () => {
    const { home, search } = setUp();
    return Effect.gen(function* () {
      expect(yield* search(`${home}/.h`)).toEqual([join(home, ".hidden")]);
      expect(yield* search(`${home}/.c`)).toEqual([join(home, ".config")]);
    });
  });
});

describe("searching by name", () => {
  it.effect("leaves out the same skipped folders", () => {
    const { search } = setUp();
    return Effect.gen(function* () {
      for (const name of ["node_modules", "dist", "build", "coverage", "__pycache__"]) {
        expect(yield* search(name), name).toEqual([]);
      }
    });
  });
});

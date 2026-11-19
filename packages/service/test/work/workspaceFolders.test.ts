import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { call } from "../fixtures/service.ts";
import { failureOf, failureOfPairedDevice, setUp } from "../fixtures/workspaces.ts";

describe("browsing folders for the phone", () => {
  it.live("starts the browsable roots with the home folder", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      const roots = yield* call({ _tag: "BrowseFolders", path: null, shouldIncludeHidden: false });
      expect(roots.folders.map((folder) => folder.path)).toEqual([home]);
    }).pipe(Effect.provide(layer));
  });

  it.live("lists a folder's visible subfolders and its parent below the root", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      const listing = yield* call({ _tag: "BrowseFolders", path: home, shouldIncludeHidden: false });
      expect(listing).toMatchObject({ parent: null, path: home });
      expect(listing.folders.map((folder) => folder.name)).toEqual(["app"]);

      const inner = yield* call({ _tag: "BrowseFolders", path: join(home, "app"), shouldIncludeHidden: false });
      expect(inner.parent).toBe(home);
      expect(inner.folders.map((folder) => folder.name)).toEqual(["lib"]);
    }).pipe(Effect.provide(layer));
  });

  it.live("lists hidden folders only when asked", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      const listing = yield* call({ _tag: "BrowseFolders", path: home, shouldIncludeHidden: true });
      expect(listing.folders.map((folder) => folder.name)).toEqual([".hidden", "app"]);
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses a paired device folders outside the roots, including through a link", () => {
    const { home, layer, outside } = setUp();
    symlinkSync(outside, join(home, "shortcut"));
    return Effect.gen(function* () {
      const refused = yield* failureOfPairedDevice({
        _tag: "BrowseFolders",
        path: outside,
        shouldIncludeHidden: false,
      });
      expect(refused.kind).toBe("InvalidInput");
      const linked = yield* failureOfPairedDevice({
        _tag: "BrowseFolders",
        path: join(home, "shortcut"),
        shouldIncludeHidden: false,
      });
      expect(linked.message).toContain("outside the browsable roots");
    }).pipe(Effect.provide(layer));
  });

  it.live("adds a root, after which its folders can be browsed", () => {
    const { home, layer, outside } = setUp();
    return Effect.gen(function* () {
      const roots = yield* call({ _tag: "AddBrowsableRoot", path: outside });
      expect(roots.folders.map((folder) => folder.path)).toEqual([home, outside]);
      const listing = yield* call({ _tag: "BrowseFolders", path: outside, shouldIncludeHidden: false });
      expect(listing.path).toBe(outside);
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses to add a root that is not an existing folder", () => {
    const { layer, outside } = setUp();
    return Effect.gen(function* () {
      const missing = yield* failureOf({ _tag: "AddBrowsableRoot", path: join(outside, "nothing") });
      expect(missing.kind).toBe("InvalidInput");
    }).pipe(Effect.provide(layer));
  });

  it.live("makes a new folder under a root", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      const made = yield* call({ _tag: "CreateFolder", name: "notes", parent: home });
      expect(made).toEqual({ name: "notes", path: join(home, "notes") });
      const listing = yield* call({ _tag: "BrowseFolders", path: home, shouldIncludeHidden: false });
      expect(listing.folders.map((folder) => folder.name)).toEqual(["app", "notes"]);
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses a new folder name with a slash", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      const refused = yield* failureOf({ _tag: "CreateFolder", name: "../escape", parent: home });
      expect(refused.kind).toBe("InvalidInput");
    }).pipe(Effect.provide(layer));
  });
});

import { mkdirSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { folderEscapeOf } from "../../src/harness/index.ts";
import { temporary } from "../fixtures/service.ts";

describe("checking a thread's folder before sandboxing it there", () => {
  /** A workspace, a scratch root holding one mission's folder, and a folder outside both, by their real paths. */
  const foldersOf = () => {
    const root = realpathSync(temporary("outlore-sandbox-"));
    for (const folder of ["workspace", "missions/m1", "elsewhere"]) mkdirSync(join(root, folder), { recursive: true });
    return {
      elsewhere: join(root, "elsewhere"),
      root,
      scratch: join(root, "missions", "m1"),
      scratchRoot: join(root, "missions"),
      workspace: join(root, "workspace"),
    };
  };

  it("finds nothing wrong with a plain workspace or scratch folder", () => {
    const { scratch, scratchRoot, workspace } = foldersOf();
    expect(folderEscapeOf(workspace, workspace, true)).toBeNull();
    expect(folderEscapeOf(scratch, scratchRoot, false)).toBeNull();
  });

  it("names a workspace folder that became a link, and where it points", () => {
    const { elsewhere, workspace } = foldersOf();
    rmSync(workspace, { recursive: true });
    symlinkSync(elsewhere, workspace);
    expect(folderEscapeOf(workspace, workspace, true)).toEqual({ folder: workspace, pointsTo: elsewhere });
  });

  it("names a workspace folder reached through a folder that became a link", () => {
    const { elsewhere, root } = foldersOf();
    mkdirSync(join(elsewhere, "project"));
    symlinkSync(elsewhere, join(root, "parent"));
    const stored = join(root, "parent", "project");
    expect(folderEscapeOf(stored, stored, true)).toEqual({ folder: stored, pointsTo: join(elsewhere, "project") });
  });

  it("names a scratch folder linked to the whole disk, outside its root, or even inside it", () => {
    const { elsewhere, scratch, scratchRoot } = foldersOf();
    rmSync(scratch, { recursive: true });
    symlinkSync("/", scratch);
    expect(folderEscapeOf(scratch, scratchRoot, false)).toEqual({ folder: scratch, pointsTo: "/" });
    rmSync(scratch);
    symlinkSync(elsewhere, scratch);
    expect(folderEscapeOf(scratch, scratchRoot, false)).toEqual({ folder: scratch, pointsTo: elsewhere });
    mkdirSync(join(scratchRoot, "m2"));
    rmSync(scratch);
    symlinkSync(join(scratchRoot, "m2"), scratch);
    expect(folderEscapeOf(scratch, scratchRoot, false)).toEqual({ folder: scratch, pointsTo: join(scratchRoot, "m2") });
  });

  it("names a link pointing nowhere by what it names", () => {
    const { root, scratch, scratchRoot } = foldersOf();
    rmSync(scratch, { recursive: true });
    symlinkSync(join(root, "gone"), scratch);
    expect(folderEscapeOf(scratch, scratchRoot, false)).toEqual({ folder: scratch, pointsTo: join(root, "gone") });
  });

  it("names a scratch root that became a link, but not one below a linked system folder", () => {
    const { elsewhere, root, scratchRoot } = foldersOf();
    mkdirSync(join(elsewhere, "missions", "m1"), { recursive: true });
    rmSync(scratchRoot, { recursive: true });
    symlinkSync(join(elsewhere, "missions"), scratchRoot);
    expect(folderEscapeOf(join(scratchRoot, "m1"), scratchRoot, false)).toEqual({
      folder: scratchRoot,
      pointsTo: join(elsewhere, "missions"),
    });
    // The service's own data folder may sit below a linked folder of the system, such as /var on macOS.
    symlinkSync(elsewhere, join(root, "system"));
    const below = join(root, "system", "missions");
    expect(folderEscapeOf(join(below, "m1"), below, false)).toBeNull();
  });
});

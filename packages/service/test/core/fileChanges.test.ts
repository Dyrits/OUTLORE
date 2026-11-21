import { describe, expect, it } from "@effect/vitest";
import { maxDiffBytes } from "@outlore/contracts";
import { editChangeOf, linesOfStoredDiff, storedDiffOf, writeChangeOf } from "../../src/core/fileChanges.ts";

describe("what an Edit or a MultiEdit changes", () => {
  it("reads an Edit's old and new text as a diff of its lines", () => {
    const change = editChangeOf("Edit", {
      file_path: "/a.ts",
      new_string: "const x = 2;\nreturn x;",
      old_string: "const x = 1;\nreturn x;",
    });
    expect(change).toMatchObject({ added: 1, note: null, removed: 1 });
    expect(change?.lines.map((line) => `${line.kind}:${line.text}`)).toEqual([
      "Removed:const x = 1;",
      "Added:const x = 2;",
      "Context:return x;",
    ]);
  });

  it("joins the edits of a MultiEdit, one gap between them", () => {
    const change = editChangeOf("MultiEdit", {
      edits: [
        { new_string: "b", old_string: "a" },
        { new_string: "d", old_string: "c" },
      ],
      file_path: "/a.ts",
    });
    expect(change?.lines.map((line) => `${line.kind}:${line.text}`)).toEqual([
      "Removed:a",
      "Added:b",
      "Gap:…",
      "Removed:c",
      "Added:d",
    ]);
    expect(change).toMatchObject({ added: 2, removed: 2 });
  });

  it("shows an Edit that inserts text, whose old text is empty, as additions", () => {
    expect(editChangeOf("Edit", { file_path: "/a.ts", new_string: "x\ny", old_string: "" })).toMatchObject({
      added: 2,
      removed: 0,
    });
  });

  it("gives no change for a call that modifies no file, or an edit that lacks its texts", () => {
    expect(editChangeOf("Read", { file_path: "/a.ts" })).toBeNull();
    expect(editChangeOf("Edit", { file_path: "/a.ts" })).toBeNull();
    expect(editChangeOf("MultiEdit", { edits: [], file_path: "/a.ts" })).toBeNull();
  });
});

describe("what a whole-file Write changes", () => {
  it("diffs the text written against the text before", () => {
    expect(writeChangeOf("one\ntwo\n", "one\n2\n")).toMatchObject({ added: 1, note: null, removed: 1 });
  });

  it("shows a file with no previous text as all additions", () => {
    expect(writeChangeOf(null, "a\nb\nc")).toMatchObject({ added: 3, removed: 0 });
  });

  it("says the previous text is not known when the file already holds what is written", () => {
    const change = writeChangeOf("same\n", "same\n");
    expect(change).toMatchObject({ added: null, lines: [], removed: null });
    expect(change.note).toContain("not known");
  });

  it("shows no diff for a binary file", () => {
    expect(writeChangeOf("a\u0000b", "c").note).toBe("A binary file: no diff.");
    expect(writeChangeOf(null, "c\u0000d").note).toBe("A binary file: no diff.");
  });
});

describe("keeping a diff", () => {
  it("stores a diff whole and reads the same lines back", () => {
    const change = writeChangeOf("a\nb\n", "a\nc\n");
    const stored = storedDiffOf(change);
    expect(stored.note).toBeNull();
    expect(linesOfStoredDiff(stored.text)).toEqual(change.lines);
  });

  it("keeps a line that begins like a prefix whole", () => {
    const change = writeChangeOf("", "+ plus\n- minus\n~ tilde\n");
    expect(linesOfStoredDiff(storedDiffOf(change).text)).toEqual(change.lines);
  });

  it("cuts a diff at a line once it passes the limit and says so, the counts staying those of the whole", () => {
    const content = Array.from({ length: 20_000 }, (_, index) => `generated line number ${index} of the file`).join(
      "\n",
    );
    const change = writeChangeOf(null, content);
    const stored = storedDiffOf(change);
    expect(change.added).toBe(20_000);
    expect(Buffer.byteLength(stored.text)).toBeLessThanOrEqual(maxDiffBytes);
    expect(stored.note).toBe("Diff cut: only the first 64 KB is kept.");
    expect(linesOfStoredDiff(stored.text).length).toBeLessThan(20_000);
    expect(linesOfStoredDiff(stored.text).at(-1)?.text).toMatch(/^generated line number \d+ of the file$/);
  });
});

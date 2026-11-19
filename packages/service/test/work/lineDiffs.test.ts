import { describe, expect, it } from "@effect/vitest";
import { countsOf, lineDiffOf, withContextOf } from "../../src/work/lineDiffs.ts";

const kindsOf = (lines: ReadonlyArray<{ kind: string; text: string }>) =>
  lines.map((line) => `${line.kind}:${line.text}`);

describe("diffing two texts line by line", () => {
  it("shows a changed line as removed then added, with its neighbours as context", () => {
    expect(kindsOf(lineDiffOf("a\nb\nc\n", "a\nB\nc\n"))).toEqual(["Context:a", "Removed:b", "Added:B", "Context:c"]);
  });

  it("shows nothing changed for two equal texts, with or without a trailing newline", () => {
    expect(countsOf(lineDiffOf("a\nb", "a\nb"))).toEqual({ added: 0, removed: 0 });
    expect(countsOf(lineDiffOf("a\nb\n", "a\nb\n"))).toEqual({ added: 0, removed: 0 });
  });

  it("shows a last line that gains its newline as changed, with a remark", () => {
    expect(kindsOf(lineDiffOf("a\nb", "a\nb\n"))).toEqual([
      "Context:a",
      "Removed:b",
      "Gap:No newline at end of file",
      "Added:b",
    ]);
  });

  it("shows a last line that loses its newline as changed, with a remark", () => {
    expect(kindsOf(lineDiffOf("a\nb\n", "a\nb"))).toEqual([
      "Context:a",
      "Removed:b",
      "Added:b",
      "Gap:No newline at end of file",
    ]);
  });

  it("shows a new file as all additions and an emptied file as all removals", () => {
    expect(countsOf(lineDiffOf("", "x\ny\n"))).toEqual({ added: 2, removed: 0 });
    expect(countsOf(lineDiffOf("x\ny\n", ""))).toEqual({ added: 0, removed: 2 });
  });

  it("keeps a moved block's lines in order, adding and removing as few lines as it can", () => {
    const counts = countsOf(lineDiffOf("1\n2\n3\n4\n5\n", "1\n2\n3\nnew\n4\n5\n"));
    expect(counts).toEqual({ added: 1, removed: 0 });
  });

  it("shows a rewrite too large to compare as the old lines removed and the new ones added", () => {
    const previous = Array.from({ length: 2500 }, (_, index) => `old ${index}`).join("\n");
    const next = Array.from({ length: 2500 }, (_, index) => `new ${index}`).join("\n");
    expect(countsOf(lineDiffOf(previous, next))).toEqual({ added: 2500, removed: 2500 });
  });
});

describe("cutting a diff down to its changes", () => {
  const numbered = (count: number) => Array.from({ length: count }, (_, index) => `line ${index}`).join("\n");

  it("keeps two lines of context around each change and joins stretches left apart with a gap", () => {
    const next = numbered(40).replace("line 5\n", "five\n").replace("line 30\n", "thirty\n");
    const lines = withContextOf(lineDiffOf(numbered(40), next), 2);
    expect(kindsOf(lines)).toEqual([
      "Context:line 3",
      "Context:line 4",
      "Removed:line 5",
      "Added:five",
      "Context:line 6",
      "Context:line 7",
      "Gap:…",
      "Context:line 28",
      "Context:line 29",
      "Removed:line 30",
      "Added:thirty",
      "Context:line 31",
      "Context:line 32",
    ]);
  });
});

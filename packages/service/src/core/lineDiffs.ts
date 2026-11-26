import type { DiffLine } from "@outlore/contracts";

// A line diff between two texts, in memory (action-approval, A modified file's diff). No library: the job is small, and
// the host must never hand a file to another tool.

/** The most lines the middle of a diff may compare pair by pair; a larger rewrite is shown as removed then added. */
const maxComparedPairs = 4_000_000;

/** A text's lines, with whether it ends in a newline; the empty text has no lines. */
const linesOf = (text: string) => {
  if (text === "") {
    const none: Array<string> = [];
    return { endsInNewline: true, lines: none };
  }
  const lines = text.split("\n");
  const endsInNewline = lines.at(-1) === "";
  if (endsInNewline) lines.pop();
  return { endsInNewline, lines };
};

/** The lines of the longest run both sides share, found by the classic table; null when the table would be too large. */
const sharedRunsOf = (previous: ReadonlyArray<string>, next: ReadonlyArray<string>) => {
  if (previous.length * next.length > maxComparedPairs) return null;
  const width = next.length + 1;
  const lengths = new Uint32Array((previous.length + 1) * width);
  for (let row = previous.length - 1; row >= 0; row--) {
    for (let column = next.length - 1; column >= 0; column--) {
      lengths[row * width + column] =
        previous[row] === next[column]
          ? (lengths[(row + 1) * width + column + 1] ?? 0) + 1
          : Math.max(lengths[(row + 1) * width + column] ?? 0, lengths[row * width + column + 1] ?? 0);
    }
  }
  return lengths;
};

/** The edit script between two lists of lines, every line either kept, removed, or added, in order. */
const scriptOf = (previous: ReadonlyArray<string>, next: ReadonlyArray<string>): Array<DiffLine> => {
  // What both sides share at the start and the end needs no comparing.
  let start = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) start++;
  let end = 0;
  while (
    end < previous.length - start &&
    end < next.length - start &&
    previous[previous.length - 1 - end] === next[next.length - 1 - end]
  )
    end++;
  const middlePrevious = previous.slice(start, previous.length - end);
  const middleNext = next.slice(start, next.length - end);
  const script: Array<DiffLine> = previous.slice(0, start).map((text) => ({ kind: "Context", text }));
  const lengths = sharedRunsOf(middlePrevious, middleNext);
  if (lengths === null) {
    for (const text of middlePrevious) script.push({ kind: "Removed", text });
    for (const text of middleNext) script.push({ kind: "Added", text });
  } else {
    const width = middleNext.length + 1;
    let row = 0;
    let column = 0;
    while (row < middlePrevious.length || column < middleNext.length) {
      const before = middlePrevious[row];
      const after = middleNext[column];
      if (before !== undefined && before === after) {
        script.push({ kind: "Context", text: before });
        row++;
        column++;
      } else if (
        before !== undefined &&
        (after === undefined || (lengths[(row + 1) * width + column] ?? 0) >= (lengths[row * width + column + 1] ?? 0))
      ) {
        script.push({ kind: "Removed", text: before });
        row++;
      } else if (after !== undefined) {
        script.push({ kind: "Added", text: after });
        column++;
      }
    }
  }
  for (const text of previous.slice(previous.length - end)) script.push({ kind: "Context", text });
  return script;
};

/** The remark a diff carries where a last line gains or loses its newline, as `diff` words it. */
const noNewlineRemark = "No newline at end of file";

/**
 * The diff from one text to another, every line in order: kept (Context), Removed, or Added. A last line that only
 * gains or loses its newline counts as changed, with a remark after it, so a file with no trailing newline reads right.
 */
export const lineDiffOf = (previous: string, next: string): Array<DiffLine> => {
  const before = linesOf(previous);
  const after = linesOf(next);
  if (before.endsInNewline === after.endsInNewline) return scriptOf(before.lines, after.lines);
  // Only the last line differs in its ending: mark it so it compares as different, then mark the remark under it.
  const marker = "\u0000";
  const keyed = (parts: { endsInNewline: boolean; lines: Array<string> }) =>
    parts.endsInNewline ? parts.lines : [...parts.lines.slice(0, -1), `${parts.lines.at(-1) ?? ""}${marker}`];
  return scriptOf(keyed(before), keyed(after)).flatMap((line): Array<DiffLine> => {
    const text = line.text.endsWith(marker) ? line.text.slice(0, -marker.length) : line.text;
    return line.text.endsWith(marker)
      ? [
          { kind: line.kind, text },
          { kind: "Gap", text: noNewlineRemark },
        ]
      : [{ kind: line.kind, text }];
  });
};

/**
 * A diff cut down to its changes with a few lines of context around each; two stretches the cut leaves apart are
 * joined by a Gap line. A remark line (Gap) stays beside the line it remarks on.
 */
export const withContextOf = (lines: ReadonlyArray<DiffLine>, size: number): Array<DiffLine> => {
  const isNear = lines.map(() => false);
  lines.forEach((line, index) => {
    if (line.kind === "Added" || line.kind === "Removed") {
      for (let near = Math.max(0, index - size); near <= Math.min(lines.length - 1, index + size); near++)
        isNear[near] = true;
    }
  });
  const kept: Array<DiffLine> = [];
  let isSkipping = false;
  lines.forEach((line, index) => {
    if (isNear[index] || (line.kind === "Gap" && isNear[index - 1])) {
      if (isSkipping && kept.length > 0) kept.push({ kind: "Gap", text: "…" });
      isSkipping = false;
      kept.push(line);
    } else isSkipping = true;
  });
  return kept;
};

/** How many lines of a diff were added and how many removed. */
export const countsOf = (lines: ReadonlyArray<DiffLine>) => ({
  added: lines.filter((line) => line.kind === "Added").length,
  removed: lines.filter((line) => line.kind === "Removed").length,
});

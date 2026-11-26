import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { type DiffLine, type DiffLineKind, maxDiffBytes } from "@outlore/contracts";
import { Effect } from "effect";
import { countsOf, lineDiffOf, withContextOf } from "./lineDiffs.ts";
import { fieldOf, textFieldOf } from "./records.ts";

// What a tool call that modifies a file changed, as a diff (action-approval, A modified file's diff). The diff is the
// only thing kept: never a whole file, and it is never sent to a harness. The previous text of a file a call writes
// whole is read here, in memory, just before the write, and dropped once the diff is computed.

/** Lines of context kept around each change. */
const contextSize = 2;

/** The largest file, before or after, the host diffs; a larger one is not read at all. */
const maxFileBytes = 1024 * 1024;

/** What a call changed: its counts (null when unknown), the diff lines, and what the owner should know of them. */
export type FileChange = {
  readonly added: number | null;
  readonly lines: ReadonlyArray<DiffLine>;
  readonly note: string | null;
  readonly removed: number | null;
};

/** A change whose diff is not known, with the reason. */
const unknownChange = (note: string): FileChange => ({ added: null, lines: [], note, removed: null });

/** A change from the full diff of two texts: its counts are of the whole change, its lines only the changes and context. */
const changeOfLines = (lines: ReadonlyArray<DiffLine>): FileChange => ({
  ...countsOf(lines),
  lines: withContextOf(lines, contextSize),
  note: null,
});

/** The pairs of old and new text an Edit or a MultiEdit gives, or null for any other call. */
const editPairsOf = (toolName: string, input: unknown) => {
  const pair = (edit: unknown) => ({
    next: textFieldOf(edit, "new_string"),
    previous: textFieldOf(edit, "old_string"),
  });
  const edits = toolName === "Edit" ? [input] : toolName === "MultiEdit" ? fieldOf(input, "edits") : null;
  if (!Array.isArray(edits)) return null;
  const pairs = edits.map(pair);
  return pairs.length > 0 && pairs.every((edit) => edit.next !== null && edit.previous !== null) ? pairs : null;
};

/**
 * The change an Edit or MultiEdit makes, from the call's own old and new text, or null for any other call. Several
 * edits to one file are one change, their stretches apart. The input alone decides, so nothing is read from disk.
 */
export const editChangeOf = (toolName: string, input: unknown): FileChange | null => {
  const pairs = editPairsOf(toolName, input);
  if (pairs === null) return null;
  const lines = pairs.flatMap((edit, index): Array<DiffLine> => {
    const diff = withContextOf(lineDiffOf(edit.previous ?? "", edit.next ?? ""), contextSize);
    return index === 0 ? diff : [{ kind: "Gap", text: "…" }, ...diff];
  });
  return { ...countsOf(lines), lines, note: null };
};

/**
 * What a whole-file Write changes, from the file's text before and the text written. A file the write already replaced
 * when it was read (its text equals what is written) has no known previous text, so it says so instead of guessing.
 */
export const writeChangeOf = (previous: string | null, content: string): FileChange => {
  if (previous === content)
    return unknownChange(
      "The file already held this text when Outlore read it, so it was written first (or the write changed nothing); what it held before is not known.",
    );
  if (previous?.includes("\u0000")) return unknownChange("A binary file: no diff.");
  if (content.includes("\u0000")) return unknownChange("A binary file: no diff.");
  return changeOfLines(lineDiffOf(previous ?? "", content));
};

/** The text of a file before a write: null when there is no such file, a note when it cannot be shown. */
const readPrevious = (path: string) =>
  Effect.promise(async (): Promise<{ text: string | null } | { note: string }> => {
    try {
      const bytes = await readFile(path);
      return bytes.length > maxFileBytes
        ? { note: "The file is too large to show a diff." }
        : { text: bytes.toString("utf8") };
    } catch (error) {
      return fieldOf(error, "code") === "ENOENT" ? { text: null } : { note: "Outlore could not read the file." };
    }
  });

/**
 * The change a Claude Code call makes to a file: an Edit or MultiEdit from its input; a Write by reading the file as it
 * stands, since the harness reports the call before it runs. Null for a call that modifies no file (and for
 * NotebookEdit, which gives no previous text: its step has no diff).
 */
export const fileChangeOf = Effect.fnUntraced(function* (toolName: string, input: unknown, folder: string) {
  const edit = editChangeOf(toolName, input);
  if (edit !== null) return edit;
  const path = textFieldOf(input, "file_path");
  const content = textFieldOf(input, "content");
  if (toolName !== "Write" || path === null || content === null) return null;
  if (Buffer.byteLength(content) > maxFileBytes) return unknownChange("The file is too large to show a diff.");
  const before = yield* readPrevious(isAbsolute(path) ? path : resolve(folder, path));
  return "note" in before ? unknownChange(before.note) : writeChangeOf(before.text, content);
});

/** The patch, text or captured change a harness reports for a file edit. */
export type ReportedFileEdit =
  | { readonly patch: string; readonly movedTo: string | null }
  | { readonly pairs: ReadonlyArray<{ readonly previous: string; readonly next: string }> | null }
  | { readonly change: FileChange };

/** Converts a native patch or reported before and after text to the stored diff. */
export const reportedChangeOf = (edit: ReportedFileEdit): FileChange => {
  if ("change" in edit) return edit.change;
  if ("pairs" in edit) {
    if (edit.pairs === null) return unknownChange("The harness did not report the previous file text.");
    const lines: Array<DiffLine> = [];
    for (const { previous, next } of edit.pairs) {
      if (Buffer.byteLength(previous) > maxFileBytes || Buffer.byteLength(next) > maxFileBytes)
        return unknownChange("The file is too large to show a diff.");
      if (previous.includes("\u0000") || next.includes("\u0000")) return unknownChange("A binary file: no diff.");
      const hunk = withContextOf(lineDiffOf(previous, next), contextSize);
      if (hunk.length === 0) continue;
      if (lines.length > 0) lines.push({ kind: "Gap", text: "…" });
      for (const line of hunk) lines.push(line);
    }
    return { ...countsOf(lines), lines, note: null };
  }

  if (Buffer.byteLength(edit.patch) > 2 * maxFileBytes) return unknownChange("The patch is too large to show a diff.");
  if (edit.patch.includes("\u0000")) return unknownChange("A binary file: no diff.");
  const lines: Array<DiffLine> = [];
  let hasHunk = false;
  let isInHunk = false;
  for (const row of edit.patch.split("\n")) {
    if (/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(row)) {
      if (hasHunk) lines.push({ kind: "Gap", text: "…" });
      hasHunk = true;
      isInHunk = true;
    } else if (isInHunk) {
      const kind = kindOfPrefix.get(row[0] ?? "");
      if (row === "\\ No newline at end of file" || row === "\\ No newline at end of file\r")
        lines.push({ kind: "Gap", text: "No newline at end of file" });
      else if (kind !== undefined && kind !== "Gap") lines.push({ kind, text: row.slice(1) });
      else isInHunk = false;
    }
  }
  if (!hasHunk && edit.movedTo === null) return unknownChange("The harness did not report a textual patch.");
  return {
    ...countsOf(lines),
    lines: withContextOf(lines, contextSize),
    note: edit.movedTo === null ? null : `Moved to ${edit.movedTo}`,
  };
};

const prefixes = { Added: "+", Context: " ", Gap: "~", Removed: "-" } satisfies Record<DiffLineKind, string>;
const kindOfPrefix = new Map(
  Object.entries({ " ": "Context", "-": "Removed", "+": "Added", "~": "Gap" } satisfies Record<string, DiffLineKind>),
);

/**
 * A change's diff lines as stored text, one line each with a one-character prefix, cut at a line once the text would pass
 * the size limit; the note then says so, and the counts stay those of the whole change.
 */
export const storedDiffOf = (change: FileChange, limit = maxDiffBytes) => {
  const kept: Array<string> = [];
  let size = 0;
  for (const line of change.lines) {
    const row = `${prefixes[line.kind]}${line.text}`;
    size += Buffer.byteLength(row) + 1;
    if (size > limit) {
      return { note: `Diff cut: only the first ${Math.round(limit / 1024)} KB is kept.`, text: kept.join("\n") };
    }
    kept.push(row);
  }
  return { note: change.note, text: kept.join("\n") };
};

/** The lines of a stored diff text, as `storedDiffOf` wrote them. */
export const linesOfStoredDiff = (text: string): Array<DiffLine> =>
  text === ""
    ? []
    : text.split("\n").map((row) => ({ kind: kindOfPrefix.get(row.slice(0, 1)) ?? "Context", text: row.slice(1) }));

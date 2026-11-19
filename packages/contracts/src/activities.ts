import { Schema } from "effect";

// What a working thread does, line by line, beside the actions it asked about (action-approval, What a working thread is doing).

/**
 * How many lines a call that modified a file added and removed; the diff itself is read on demand with `ReadFileDiff`.
 * A count is null when the host could not know what the file was before (action-approval, A modified file's diff).
 */
export const FileChange = Schema.Struct({
  added: Schema.NullOr(Schema.Number),
  removed: Schema.NullOr(Schema.Number),
});
export type FileChange = typeof FileChange.Type;

/**
 * One tool call a thread's harness reported as it started: plain words for the kind of call, and a short target such as
 * a file or a pattern. A record to read, with no buttons and no permission.
 */
export const Activity = Schema.Struct({
  at: Schema.Number,
  /**
   * What a call that modified a file changed, as counts only; absent from every other call, and from a host that
   * predates it. A call's output and a file's content are never carried here.
   */
  change: Schema.optionalKey(FileChange),
  /** A short plain target: a file, a pattern, or a command's description or first line; never output or content. */
  detail: Schema.String,
  /** The harness's own identifier of the call. */
  id: Schema.String,
  /** The kind of call in plain words, such as "Read a file". */
  summary: Schema.String,
});
export type Activity = typeof Activity.Type;

/** How one line of a diff reads: added, removed, unchanged context, or a gap between two stretches (or a remark). */
export const DiffLineKind = Schema.Literals(["Added", "Removed", "Context", "Gap"]);
export type DiffLineKind = typeof DiffLineKind.Type;

/** One line of a diff, without its newline. */
export const DiffLine = Schema.Struct({ kind: DiffLineKind, text: Schema.String });
export type DiffLine = typeof DiffLine.Type;

/**
 * What a call changed in one file, as changed text kept on the host: a few lines of context around each change, cut at
 * a size limit with a note. Read when the owner opens a step's fold, never sent with the steps list.
 */
export const FileDiff = Schema.Struct({
  added: Schema.NullOr(Schema.Number),
  lines: Schema.Array(DiffLine),
  /** What the owner should know about the diff: that it was cut, or why there is none; null when it is whole. */
  note: Schema.NullOr(Schema.String),
  removed: Schema.NullOr(Schema.Number),
});
export type FileDiff = typeof FileDiff.Type;

/** The most a file's stored diff may hold, in bytes; the rest is cut and the diff says so. */
export const maxDiffBytes = 64 * 1024;

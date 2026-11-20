import { fieldOf, type HarnessEvent, type ReportedFileEdit, textFieldOf } from "../core/index.ts";

/** Builds a separate Steps entry for each file a completed tool call changed. */
const fileEditEventOf = (
  callId: string,
  path: string,
  fileEdit: ReportedFileEdit,
): Extract<HarnessEvent, { _tag: "ToolCall" }> => ({
  _tag: "ToolCall",
  fileEdit,
  id: JSON.stringify([callId, path]),
  input: { file_path: path },
  toolName: "Edit",
});

/** Reads Codex's completed apply-patch item, whose adds and deletes carry plain text. */
export const codexFileEditsOf = (item: unknown, turnId: string) => {
  const id = textFieldOf(item, "id");
  const changes = fieldOf(item, "changes");
  if (id === null || textFieldOf(item, "status") !== "completed" || !Array.isArray(changes)) return [];
  const callId = JSON.stringify(["codex", turnId, id]);
  return changes.flatMap((change) => {
    const path = textFieldOf(change, "path");
    const patch = textFieldOf(change, "diff");
    const kind = fieldOf(change, "kind");
    const type = textFieldOf(kind, "type");
    if (!path || patch === null) return [];
    if (type === "add") return [fileEditEventOf(callId, path, { pairs: [{ next: patch, previous: "" }] })];
    if (type === "delete") return [fileEditEventOf(callId, path, { pairs: [{ next: "", previous: patch }] })];
    if (type !== "update") return [];
    return [fileEditEventOf(callId, path, { movedTo: textFieldOf(kind, "movePath"), patch })];
  });
};

/** Reads ACP text pairs from completed calls and uses result metadata when it gives the actual file contents. */
export const acpFileEditsOf = (update: unknown, sessionId: string, harness: "opencode" | "vibe") => {
  const id = textFieldOf(update, "toolCallId");
  if (id === null || textFieldOf(update, "status") !== "completed") return [];
  const callId = JSON.stringify([harness, sessionId, id]);
  const output = fieldOf(update, "rawOutput");
  const metadata = fieldOf(output, "metadata");
  const content = fieldOf(update, "content");
  if (harness === "opencode") {
    const path = textFieldOf(fieldOf(metadata, "filediff"), "file") ?? textFieldOf(metadata, "filepath");
    const patch = textFieldOf(metadata, "diff");
    if (path && patch !== null) return [fileEditEventOf(callId, path, { movedTo: null, patch })];
  } else {
    const path = textFieldOf(output, "filePath");
    const next = textFieldOf(output, "content");
    const previous = textFieldOf(output, "previousContent");
    const isNew = fieldOf(output, "fileExisted") === false;
    if (path && next !== null && (previous !== null || isNew))
      return [{ ...fileEditEventOf(callId, path, { pairs: [{ next, previous: previous ?? "" }] }), id }];
  }
  if (!Array.isArray(content)) return [];

  const input = fieldOf(update, "rawInput");
  const exists = fieldOf(metadata, "exists");
  const files = new Map<string, Array<{ next: string; previous: string }> | null>();
  for (const block of content) {
    if (textFieldOf(block, "type") !== "diff") continue;
    const path = textFieldOf(block, "path");
    const next = textFieldOf(block, "newText");
    const previous = textFieldOf(block, "oldText");
    if (!path || next === null) continue;
    // Older OpenCode versions use an empty oldText for writes, including overwrites.
    const isOpenCodeWrite =
      harness === "opencode" && (typeof exists === "boolean" || textFieldOf(input, "content") !== null);
    const before = isOpenCodeWrite && exists !== false && previous === "" ? null : previous;
    const pair = before !== null ? { next, previous: before } : null;
    const pairs = files.get(path);
    if (pair === null) files.set(path, null);
    else if (pairs === undefined) files.set(path, [pair]);
    else pairs?.push(pair);
  }
  return [...files].map(([path, pairs], index) => {
    const event = fileEditEventOf(callId, path, { pairs });
    return harness === "vibe" && index === 0 ? { ...event, id } : event;
  });
};

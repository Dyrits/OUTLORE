import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { textFieldOf } from "../core/index.ts";

// Where a thread's tool calls move its shell (conversation-terminal, Starting folder). No harness reports its current
// folder, so it is inferred from the calls the thread makes: a `cd`, a `git worktree add`, Claude Code's worktree tools.
// The result is only a candidate: `workingFolders.ts` checks it against the disk and the workspace.

/** A call's folder move: a candidate path, `null` to go back to where the thread started, `undefined` for no move. */
export type FolderMove = string | null | undefined;

/** A word of a command; null when the shell would expand it to something unknown here (`$HOME`, a substitution, a glob). */
type Word = string | null;

/** One simple command of a command line, with whether the shell runs it in the thread's own shell. */
type Segment = { readonly isInShell: boolean; readonly words: ReadonlyArray<Word> };

const expandingCharacters = new Set(["$", "`", "*", "?", "[", "{"]);

/**
 * Splits a command line into its simple commands, honoring quotes and backslashes. A command in a subshell,
 * a pipeline, a background job, or the right side of `||` does not move the thread's shell, so it is marked.
 */
const segmentsOf = (line: string, home: string): ReadonlyArray<Segment> => {
  const segments: Array<Array<Word>> = [];
  const separators: Array<string> = [];
  let words: Array<Word> = [];
  let word: string | null = null;
  let isUnknown = false;
  let depth = 0;
  const depths: Array<number> = [];
  const endWord = () => {
    if (word === null) return;
    words.push(isUnknown ? null : word);
    word = null;
    isUnknown = false;
  };
  const endSegment = (separator: string) => {
    endWord();
    if (words.length > 0) {
      segments.push(words);
      depths.push(depth);
      separators.push(separator);
    }
    words = [];
  };
  const add = (character: string) => {
    word = (word ?? "") + character;
  };
  for (let index = 0; index < line.length; index++) {
    const character = line.charAt(index);
    const next = line.charAt(index + 1);
    if (character === "\\") {
      if (next === "\n") index++;
      else {
        add(next);
        index++;
      }
    } else if (character === "'") {
      const close = line.indexOf("'", index + 1);
      const end = close === -1 ? line.length : close;
      add(line.slice(index + 1, end));
      index = end;
    } else if (character === '"') {
      word ??= "";
      for (index++; index < line.length && line.charAt(index) !== '"'; index++) {
        const inner = line.charAt(index);
        if (inner === "\\" && index + 1 < line.length) {
          index++;
          add(line.charAt(index));
        } else {
          if (inner === "$" || inner === "`") isUnknown = true;
          add(inner);
        }
      }
    } else if (character === " " || character === "\t") endWord();
    else if (character === "\n" || character === ";") endSegment(";");
    else if (character === "&" && next === "&") {
      endSegment("&&");
      index++;
    } else if (character === "&") endSegment("&");
    else if (character === "|") {
      const isOr = next === "|";
      endSegment(isOr ? "||" : "|");
      if (isOr || next === "&") index++;
    } else if (character === "(") {
      endSegment(";");
      depth++;
    } else if (character === ")") {
      endSegment(";");
      depth = Math.max(0, depth - 1);
    } else if (character === "#" && word === null) {
      // A comment runs to the end of the line.
      while (index + 1 < line.length && line.charAt(index + 1) !== "\n") index++;
    } else {
      if (expandingCharacters.has(character)) isUnknown = true;
      if (character === "~" && word === null && (next === "" || next === "/" || next === " ")) add(home);
      else add(character);
    }
  }
  endSegment(";");
  return segments.map((segment, index): Segment => {
    const before = index === 0 ? ";" : (separators[index - 1] ?? ";");
    const after = separators[index] ?? ";";
    const isInShell = (depths[index] ?? 0) === 0 && before !== "|" && before !== "||" && after !== "|" && after !== "&";
    return { isInShell, words: segment };
  });
};

/** A folder path as the shell would resolve it from `base`; null when it names something not known from the text. */
const pathFrom = (base: string, value: Word | undefined) =>
  value === undefined || value === null || value === "" ? null : resolve(base, value);

/** The folder a `cd`'s words lead to, or null when it leads nowhere known (no argument, `-`, an expansion). */
const cdTarget = (base: string, args: ReadonlyArray<Word>) => {
  const operands = args.filter((value) => value === null || value === "-" || value === "" || !value.startsWith("-"));
  const [target, ...rest] = operands;
  return rest.length > 0 || target === "-" ? null : pathFrom(base, target);
};

/** The path a `git worktree add` creates, with `git -C` folders applied; null for any other git command. */
const worktreeAddTarget = (base: string, args: ReadonlyArray<Word>) => {
  let folder = base;
  let index = 0;
  while (index < args.length) {
    const option = args[index];
    if (option === null || option === undefined) return null;
    if (option === "-C") {
      const changed = pathFrom(folder, args[index + 1]);
      if (changed === null) return null;
      folder = changed;
      index += 2;
    } else if (option === "-c" || option === "--git-dir" || option === "--work-tree" || option === "--namespace")
      index += 2;
    else if (option.startsWith("-")) index++;
    else break;
  }
  if (args[index] !== "worktree" || args[index + 1] !== "add") return null;
  const valued = new Set(["-b", "-B", "--reason"]);
  for (let at = index + 2; at < args.length; at++) {
    const value = args[at];
    if (value === null || value === undefined) return null;
    if (valued.has(value)) at++;
    else if (!value.startsWith("-")) return pathFrom(folder, value);
  }
  return null;
};

/** What a command line does to the thread's shell folder, starting from `folder`. */
const moveByCommand = (line: string, folder: string, home: string): FolderMove => {
  let current = folder;
  for (const { isInShell, words } of segmentsOf(line, home)) {
    if (!isInShell) continue;
    const [first, ...args] = words[0] === "{" ? words.slice(1) : words;
    if (first === "cd" || first === "pushd") current = cdTarget(current, args) ?? current;
    else if (first === "git") {
      // A new worktree is made to be worked in; the agent's `cd` into it, if it comes, lands on the same folder.
      current = worktreeAddTarget(current, args) ?? current;
    }
  }
  return current === folder ? undefined : current;
};

/** Whether a call might move the shell, so a call that cannot is not looked into further. */
export const mightMoveFolder = (toolName: string, input: unknown) => {
  if (isShellTool(toolName)) {
    const command = textFieldOf(input, "command") ?? "";
    return /\b(cd|pushd|worktree)\b/.test(command);
  }
  return toolName === "EnterWorktree" || toolName === "ExitWorktree";
};

/** Whether a tool is a harness's shell tool: Claude Code's and OpenCode's `Bash`, whose input names a `command`. */
const isShellTool = (toolName: string) => toolName.toLowerCase() === "bash";

/**
 * What a tool call does to the thread's shell folder. `folder` is where the shell stood before it and `checkout` the
 * folder its turns start in. Claude Code's `Bash` and OpenCode's `Bash` are read; Codex and the ACP providers report no
 * shell command as a tool call, so they move nothing here.
 */
export const folderMoveOf = (
  toolName: string,
  input: unknown,
  folder: string,
  checkout: string,
  home = homedir(),
): FolderMove => {
  if (isShellTool(toolName)) return moveByCommand(textFieldOf(input, "command") ?? "", folder, home);
  // Claude Code's worktree tools (unverified against a live run: `EnterWorktree` is refused in `-p` mode, 2026-11-17).
  if (toolName === "ExitWorktree") return null;
  if (toolName === "EnterWorktree") {
    const path = textFieldOf(input, "path");
    if (path !== null) return isAbsolute(path) ? resolve(path) : resolve(folder, path);
    const name = textFieldOf(input, "name");
    return name === null ? undefined : resolve(checkout, ".claude", "worktrees", name);
  }
  return undefined;
};

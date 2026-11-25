import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { Predicate } from "effect";

// Ending a child process's whole tree (CHG-0208). A child started in its own process group can move its own children
// into other groups, so a signal to the root or its group alone can leave an orphan running (probe of 2026-11-12). The
// tree is read from the process table before anything dies, since an orphan loses its parent link. The OpenCode-specific
// sweep that looks for such orphans by their marker lives in harness/processTree.ts.

/** Every process's parent, read from `ps`; empty when it cannot be read. */
const readParentPids = (): Map<number, number> => {
  try {
    const table = execFileSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8" });
    return new Map(
      table
        .split("\n")
        .map((line) => line.trim().split(/\s+/).map(Number))
        .filter((pair): pair is [number, number] => pair.length === 2 && pair.every(Number.isInteger))
        .map(([pid, ppid]) => [pid, ppid] as const),
    );
  } catch {
    return new Map();
  }
};

/** The root and every process descending from it, the root first. */
export const readProcessTree = (root: number) => {
  const children = new Map<number, Array<number>>();
  for (const [pid, ppid] of readParentPids()) children.set(ppid, [...(children.get(ppid) ?? []), pid]);
  const tree = [root];
  for (let index = 0; index < tree.length; index++) tree.push(...(children.get(tree[index] ?? -1) ?? []));
  return tree;
};

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return Predicate.hasProperty(error, "code") && error.code === "EPERM";
  }
};

const signal = (pid: number, name: NodeJS.Signals) => {
  try {
    process.kill(pid, name);
  } catch {
    // Already gone.
  }
};

const sleep = (millis: number) => new Promise((resolve) => setTimeout(resolve, millis));

/** Waits until none of the processes is alive, or the time is up; returns those still alive. */
const waitForEnd = async (pids: ReadonlyArray<number>, millis: number) => {
  for (let waited = 0; waited < millis; waited += 50) {
    if (!pids.some(isAlive)) return [];
    await sleep(50);
  }
  return pids.filter(isAlive);
};

/**
 * Ends the root and all its descendants: freezes the tree so no new child escapes, reads it again, asks every process
 * to end, then kills those still alive after the grace. A root started in its own process group (`isGroupLeader`) has
 * its whole group signalled too, which reaches a member the tree no longer links to. Returns the processes still alive
 * afterwards: none, normally.
 */
export const killProcessTree = async (root: number, graceMillis = 2000, isGroupLeader = false) => {
  let tree = readProcessTree(root);
  // Stopped processes keep their parent links and start nothing more, so the tree read again is complete.
  for (let round = 0; round < 5; round++) {
    for (const pid of tree) signal(pid, "SIGSTOP");
    const again = readProcessTree(root);
    const grown = [...new Set([...tree, ...again])];
    if (grown.length === tree.length) break;
    tree = grown;
  }
  if (isGroupLeader) signal(-root, "SIGTERM");
  for (const pid of tree) {
    signal(pid, "SIGTERM");
    signal(pid, "SIGCONT");
  }
  if (isGroupLeader) signal(-root, "SIGCONT");
  const left = await waitForEnd(tree, graceMillis);
  if (isGroupLeader) signal(-root, "SIGKILL");
  for (const pid of left) signal(pid, "SIGKILL");
  return waitForEnd(left, 1000);
};

/** The environment variable that marks every sandboxed process the service starts, and its value (sweepOrphans). */
export type ProcessMarker = {
  readonly name: string;
  readonly value: string;
};

/** A running process carrying a marker: its id, its parent, and its command line without the environment. */
export type MarkedProcess = {
  readonly command: string;
  readonly pid: number;
  readonly ppid: number;
};

/** The token a process's environment holds when it carries the marker, matched whole. */
const tokenOf = (marker: ProcessMarker) => `${marker.name}=${marker.value}`;

/** The command line of each given process, read from `ps`; processes it does not list are left out. */
export const readProcessCommands = (pids: ReadonlyArray<number>): Map<number, string> => {
  try {
    const table = execFileSync("ps", ["-A", "-o", "pid=,args="], { encoding: "utf8" });
    const wanted = new Set(pids);
    const commands = new Map<number, string>();
    for (const line of table.split("\n")) {
      const match = /^\s*(\d+)\s+(.*)$/.exec(line);
      if (match?.[1] !== undefined && match[2] !== undefined && wanted.has(Number(match[1])))
        commands.set(Number(match[1]), match[2]);
    }
    return commands;
  } catch {
    return new Map<number, string>();
  }
};

/**
 * macOS: `ps -E` appends the environment to the command line, for this user's processes only. The command line alone
 * is read without `-E`, so the environment is the rest of the line and an argument can never pass for it.
 */
const markedOnMac = (token: string): Array<MarkedProcess> => {
  const read = (args: ReadonlyArray<string>) => {
    const rows = new Map<number, { command: string; ppid: number }>();
    const table = execFileSync("ps", [...args], { encoding: "utf8", maxBuffer: 64_000_000 });
    for (const line of table.split("\n")) {
      const match = /^\s*(\d+)\s+(\d+)\s(.*)$/.exec(line);
      if (match?.[1] !== undefined && match[2] !== undefined && match[3] !== undefined)
        rows.set(Number(match[1]), { command: match[3].trim(), ppid: Number(match[2]) });
    }
    return rows;
  };
  const commands = read(["-ww", "-A", "-o", "pid=,ppid=,command="]);
  const withEnvironment = read(["-E", "-ww", "-A", "-o", "pid=,ppid=,command="]);
  const marked: Array<MarkedProcess> = [];
  for (const [pid, row] of withEnvironment) {
    const command = commands.get(pid)?.command;
    if (command === undefined || !row.command.startsWith(command)) continue;
    const environment = row.command.slice(command.length).split(/\s+/);
    if (environment.includes(token)) marked.push({ command, pid, ppid: row.ppid });
  }
  return marked;
};

/** Linux: each process's starting environment in /proc/<pid>/environ, readable for this user's processes. */
const markedOnLinux = (token: string): Array<MarkedProcess> => {
  const marked: Array<MarkedProcess> = [];
  for (const entry of readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      if (!readFileSync(`/proc/${entry}/environ`, "utf8").split("\0").includes(token)) continue;
      const command = readFileSync(`/proc/${entry}/cmdline`, "utf8").split("\0").join(" ").trim();
      // The parent is the fourth field of `stat`, after the command name in parentheses.
      const stat = readFileSync(`/proc/${entry}/stat`, "utf8");
      const ppid = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
      marked.push({ command, pid: Number(entry), ppid });
    } catch {
      // Gone, or another user's process.
    }
  }
  return marked;
};

/** The running processes whose environment carries exactly this marker; empty when the table cannot be read. */
export const readMarkedProcesses = (marker: ProcessMarker): Array<MarkedProcess> => {
  try {
    if (process.platform === "darwin") return markedOnMac(tokenOf(marker));
    if (process.platform === "linux") return markedOnLinux(tokenOf(marker));
  } catch {
    // Unreadable: nothing is taken for marked.
  }
  return [];
};

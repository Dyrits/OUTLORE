import { execFileSync } from "node:child_process";
import {
  killProcessTree,
  type MarkedProcess,
  type ProcessMarker,
  readMarkedProcesses,
  readProcessTree,
} from "../core/index.ts";

// The OpenCode half of the process-tree work (CHG-0208): finding the executor OpenCode's `acp` starts for itself, and
// ending the OpenCode processes an earlier run of the service lost. The generic tree reading, ending and marker reading
// live in core/processTree.ts.

/** The command line of each given process, read from `ps`; processes it does not list are left out. */
const readProcessCommands = (pids: ReadonlyArray<number>) => {
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

/** Whether a command line is the `serve ... --stdio` executor OpenCode's `acp` starts for itself. */
const isExecutorCommand = (command: string) =>
  /(?:^|\s)serve(?:\s|$)/.test(command) && /(?:^|\s)--stdio(?:\s|$)/.test(command);

/**
 * Whether the root's own process tree holds OpenCode's executor: a descendant running `serve --stdio`, which `acp`
 * starts for itself (probe of 2026-11-12). An `acp` that served from a process outside its tree, such as an existing
 * background service, would run commands that the root's sandbox does not cover, so this is the check that those run
 * inside it. False when the tree or its command lines cannot be read: containment is then not confirmed.
 */
export const hasExecutorBelow = (root: number) => {
  const below = readProcessTree(root).slice(1);
  return [...readProcessCommands(below).values()].some(isExecutorCommand);
};

/** Whether a command line is OpenCode's: its executable, or the `serve ... --stdio` executor its `acp` starts. */
export const isOpenCodeCommand = (command: string) =>
  /(?:^|[\s/])opencode(?:\s|$)/.test(command) || isExecutorCommand(command);

/** This process and every process descending from it. */
const readOwnTree = () => new Set(readProcessTree(process.pid));

/**
 * Ends OpenCode processes the service started and lost (CHG-0208): those carrying the service's marker in their
 * environment, running OpenCode or its executor, and no longer descending from this process, such as the `serve` child
 * of an `acp` that ended first, or one left by a service that stopped. A process is never ended by its name alone,
 * nor one of this process's own living threads. Each is ended with its own tree; returns those still alive.
 */
export const sweepOrphans = async (marker: ProcessMarker) => {
  const isOrphan = (candidate: MarkedProcess, own: Set<number>) =>
    candidate.pid !== process.pid && !own.has(candidate.pid) && isOpenCodeCommand(candidate.command);
  const own = readOwnTree();
  const orphans = readMarkedProcesses(marker).filter((candidate) => isOrphan(candidate, own));
  for (const orphan of orphans) await killProcessTree(orphan.pid, 1000);
  if (orphans.length === 0) return [];
  const ownAfter = readOwnTree();
  return readMarkedProcesses(marker)
    .filter((candidate) => isOrphan(candidate, ownAfter))
    .map((candidate) => candidate.pid);
};

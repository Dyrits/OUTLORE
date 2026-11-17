import { spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { type OpenCodeSandbox, writableRootsOf, writeOwnerMarker } from "../../src/harness/openCodeSandbox.ts";
import { hasExecutorBelow, killProcessTree, readMarkedProcesses, sweepOrphans } from "../../src/harness/processTree.ts";
import { temporary } from "../fixtures/service.ts";
import { isAlive, seatbelt, waitFor } from "../fixtures/standIns.ts";
import { canReadProcessTable } from "../support/environment.ts";

const spawnChild = join(import.meta.dirname, "..", "fixtures", "stand-in-spawn-child.mjs");

describe.runIf(canReadProcessTable)("ending a harness's whole process tree", () => {
  it("kills a child that left its process group, and reports none left", async () => {
    const pidFile = join(realpathSync(temporary("outlore-sandbox-")), "grandchild");
    const parent = spawn(process.execPath, [spawnChild, pidFile, "stay"]);
    for (let attempt = 0; attempt < 100 && !existsSync(pidFile); attempt++)
      await new Promise((resolve) => setTimeout(resolve, 20));
    const grandchild = Number(readFileSync(pidFile, "utf8"));
    expect(isAlive(grandchild)).toBe(true);
    expect(await killProcessTree(parent.pid ?? -1)).toEqual([]);
    expect(isAlive(grandchild)).toBe(false);
  });
});

describe.runIf(canReadProcessTable)("confirming that OpenCode's executor runs below the wrapped process", () => {
  const withChild = async (args: Array<string>, check: (parent: number) => void) => {
    const pidFile = join(realpathSync(temporary("outlore-sandbox-")), "child");
    const parent = spawn(process.execPath, [spawnChild, pidFile, "attached", ...args]);
    try {
      for (let attempt = 0; attempt < 100 && !existsSync(pidFile); attempt++)
        await new Promise((resolve) => setTimeout(resolve, 20));
      check(parent.pid ?? -1);
    } finally {
      await killProcessTree(parent.pid ?? -1);
    }
  };

  it("sees a `serve --stdio` descendant", async () => {
    await withChild(["serve", "--stdio", "--port", "0"], (parent) => expect(hasExecutorBelow(parent)).toBe(true));
  });

  it("does not take the background service (`serve --service`) or other children for the executor", async () => {
    await withChild(["serve", "--service"], (parent) => expect(hasExecutorBelow(parent)).toBe(false));
    await withChild([], (parent) => expect(hasExecutorBelow(parent)).toBe(false));
  });

  it("confirms nothing for a process that does not exist", () => {
    expect(hasExecutorBelow(2 ** 22 + 12345)).toBe(false);
  });
});

describe.runIf(canReadProcessTable)("ending the OpenCode processes the service lost", () => {
  /** Starts a parent that starts a child of its own, in its own group, then ends: the child is an orphan. */
  const orphanOf = async (env: Record<string, string>, childArgs: Array<string>) => {
    const pidFile = join(realpathSync(temporary("outlore-sandbox-")), "orphan");
    const parent = spawn(process.execPath, [spawnChild, pidFile, "exit", ...childArgs], {
      env: { ...process.env, ...env },
      stdio: "ignore",
    });
    await waitFor(() => existsSync(pidFile) && parent.exitCode !== null);
    return Number(readFileSync(pidFile, "utf8"));
  };

  it("finds an executor that outlived its `acp` by its marker, and ends it, never an unmarked or living one", async () => {
    const marker = { name: "OUTLORE_SANDBOX_OWNER", value: crypto.randomUUID() };
    const markedEnv = { [marker.name]: marker.value };
    const started: Array<number> = [];
    try {
      const executor = await orphanOf(markedEnv, ["serve", "--stdio", "--port", "0"]);
      const unmarked = await orphanOf({}, ["serve", "--stdio", "--port", "0"]);
      const otherMarker = await orphanOf({ [marker.name]: `${marker.value}-other` }, ["serve", "--stdio"]);
      const notOpenCode = await orphanOf(markedEnv, ["watch"]);
      started.push(executor, unmarked, otherMarker, notOpenCode);
      // A marked executor still below this process belongs to a living thread.
      const living = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", "serve", "--stdio"], {
        env: { ...process.env, ...markedEnv },
        stdio: "ignore",
      });
      started.push(living.pid ?? -1);
      expect(readMarkedProcesses(marker).map((found) => found.pid)).toEqual(
        expect.arrayContaining([executor, notOpenCode, living.pid]),
      );
      expect(await sweepOrphans(marker)).toEqual([]);
      expect(await waitFor(() => !isAlive(executor))).toBe(true);
      for (const pid of [unmarked, otherMarker, notOpenCode, living.pid ?? -1]) expect(isAlive(pid)).toBe(true);
    } finally {
      for (const pid of started) if (pid > 0 && isAlive(pid)) process.kill(pid, "SIGKILL");
    }
  });

  it("reads the marker from the environment only, never from a command's arguments", async () => {
    const marker = { name: "OUTLORE_SANDBOX_OWNER", value: crypto.randomUUID() };
    const posing = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", `${marker.name}=${marker.value}`], {
      stdio: "ignore",
    });
    try {
      await waitFor(() => false, 200);
      expect(readMarkedProcesses(marker)).toEqual([]);
    } finally {
      posing.kill("SIGKILL");
    }
  });

  it("keeps one marker per service folder, outside what the sandbox may write", () => {
    const root = realpathSync(temporary("outlore-sandbox-"));
    const sandbox: OpenCodeSandbox = { ...seatbelt, caches: [], root: join(root, "opencode-sandbox") };
    const marker = writeOwnerMarker(sandbox);
    expect(marker.name).toBe("OUTLORE_SANDBOX_OWNER");
    expect(marker.value).toMatch(/^[0-9a-f-]{36}$/);
    expect(writeOwnerMarker(sandbox)).toEqual(marker);
    expect(writeOwnerMarker({ ...sandbox, root: join(root, "other") }).value).not.toBe(marker.value);
    const roots = writableRootsOf(sandbox, join(root, "work"), null);
    expect(roots.some((path) => join(sandbox.root, "owner").startsWith(`${path}/`))).toBe(false);
  });
});

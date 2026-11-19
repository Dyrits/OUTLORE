import { spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { killProcessTree, readMarkedProcesses } from "../../src/core/index.ts";
import { temporary } from "../fixtures/service.ts";
import { isAlive, waitFor } from "../fixtures/standIns.ts";
import { canReadProcessTable } from "../support/environment.ts";

const spawnChild = join(import.meta.dirname, "..", "fixtures", "stand-in-spawn-child.mjs");

describe.runIf(canReadProcessTable)("ending a child's whole process tree", () => {
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

describe.runIf(canReadProcessTable)("reading marked processes from the process table", () => {
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
});

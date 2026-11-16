import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readMarkedProcesses } from "../../src/harness/processTree.ts";

// What this environment lets a test do. A test that needs the real thing runs when it is there and is skipped, named
// as skipped, when it is not, so it never fails for want of a capability the environment withholds on purpose. Inside
// a Claude Code or Codex thread's sandbox, a process cannot apply a Seatbelt profile of its own or read other
// processes, and the suite runs there without asking the owner to leave the sandbox.

/** A process can start `sandbox-exec` with a profile of its own: false on Linux, and inside another sandbox. */
export const canApplySeatbelt =
  process.platform === "darwin" &&
  existsSync("/usr/bin/sandbox-exec") &&
  spawnSync("/usr/bin/sandbox-exec", ["-p", "(version 1)(allow default)", "/usr/bin/true"], { timeout: 10_000 })
    .status === 0;

/** The process table lists this process's children with their parents and their environment, as the sweep needs. */
export const canReadProcessTable = (() => {
  const marker = { name: "ISKIOS_TEST_PROBE", value: crypto.randomUUID() };
  const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 5000)"], {
    env: { ...process.env, [marker.name]: marker.value },
    stdio: "ignore",
  });
  try {
    const listed = spawnSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8", timeout: 10_000 }).stdout ?? "";
    const isListed = listed
      .split("\n")
      .some((line) => line.trim().split(/\s+/).join(" ") === `${child.pid} ${process.pid}`);
    return isListed && readMarkedProcesses(marker).some((found) => found.pid === child.pid);
  } finally {
    child.kill("SIGKILL");
  }
})();

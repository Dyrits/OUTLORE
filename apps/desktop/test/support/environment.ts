import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn as spawnTerminal } from "node-pty";
import { prepareTerminalHelper } from "../../src/terminals.ts";

// What this environment lets a test do. A test that needs the real thing runs when it is there and is skipped, named
// as skipped, when it is not, so it never fails for want of a capability a sandbox withholds on purpose.

/** A pseudo-terminal can be opened and a shell started in it. */
export const canOpenTerminal = (() => {
  try {
    prepareTerminalHelper();
    const terminal = spawnTerminal("/bin/sh", ["-c", "exit 0"], { cols: 80, name: "xterm", rows: 24 });
    terminal.kill();
    return true;
  } catch {
    return false;
  }
})();

/** A disk image can be made on this Mac, which `hdiutil` refuses inside a sandbox. */
export const canMakeDiskImage = (() => {
  if (process.platform !== "darwin") return false;
  const root = realpathSync(mkdtempSync(join(tmpdir(), "iskios-probe-")));
  try {
    return (
      spawnSync("hdiutil", ["create", "-size", "1m", "-fs", "HFS+", "-quiet", join(root, "probe.dmg")], {
        timeout: 30_000,
      }).status === 0
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
})();

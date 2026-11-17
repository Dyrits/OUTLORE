import { spawn, spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, realpathSync, rmSync, statSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import {
  detectOpenCodeSandbox,
  type OpenCodeSandbox,
  openCodeEnvironmentOf,
  sandboxDataHomeOf,
  wrappedCommandOf,
  writableRootsOf,
} from "../../src/harness/openCodeSandbox.ts";
import { temporary } from "../fixtures/service.ts";
import { bwrap, seatbelt, waitFor } from "../fixtures/standIns.ts";
import { canApplySeatbelt } from "../support/environment.ts";

const directory = () =>
  // Sandbox rules speak of real paths, and the system's temporary folder is itself a link on macOS.
  realpathSync(temporary("outlore-sandbox-"));

describe("wrapping OpenCode in the host's sandbox", () => {
  it("starts it under Seatbelt with writes only to its workspace, caches, and state, and the network open", () => {
    const wrapped = wrappedCommandOf(seatbelt, ["/work/app", "/caches/bun"], "opencode", ["acp"]);
    expect(wrapped.command).toBe("/usr/bin/sandbox-exec");
    expect(wrapped.args).toEqual([
      "-D",
      "W0=/work/app",
      "-D",
      "W1=/caches/bun",
      "-p",
      expect.any(String),
      "opencode",
      "acp",
    ]);
    const profile = wrapped.args[5] ?? "";
    expect(profile).toContain("(version 1)");
    expect(profile).toContain("(allow default)");
    expect(profile).toContain("(deny file-write*)");
    expect(profile).toContain('(allow file-write* (subpath (param "W0")) (subpath (param "W1"))');
    expect(profile).toContain('(literal "/dev/null")');
    expect(profile).toContain('(literal "/dev/tty")');
    expect(profile).toContain('(regex #"^/dev/(fd|ttys)")');
    expect(profile).not.toContain("network");
  });

  it("lets a Seatbelt-wrapped process signal only the processes of its own sandbox", () => {
    const args = wrappedCommandOf(seatbelt, ["/work/app"], "opencode", ["acp"]).args;
    const profile = args[args.indexOf("-p") + 1] ?? "";
    expect(profile).toContain("(deny signal)");
    expect(profile).toContain("(allow signal (target same-sandbox))");
    // The signal rules come after `(allow default)`: in a Seatbelt profile the last matching rule wins.
    expect(profile.indexOf("(deny signal)")).toBeGreaterThan(profile.indexOf("(allow default)"));
  });

  it.runIf(canApplySeatbelt)(
    "stops a Seatbelt-wrapped process from killing one outside, and lets it kill its own child",
    async () => {
      const outside = spawn("sleep", ["60"], { stdio: "ignore" });
      try {
        const wrapped = wrappedCommandOf(seatbelt, [], "/bin/sh", [
          "-c",
          `kill -TERM ${outside.pid}; sleep 30 & kill $!`,
        ]);
        const result = spawnSync(wrapped.command, [...wrapped.args], { encoding: "utf8", timeout: 10_000 });
        expect(result.stderr).toContain("Operation not permitted");
        expect(outside.exitCode).toBeNull();
        expect(outside.signalCode).toBeNull();
      } finally {
        outside.kill("SIGKILL");
      }
    },
  );

  it("lets a Seatbelt-wrapped process see only the processes of its own sandbox (audit SA-11, SA-13)", () => {
    const args = wrappedCommandOf(seatbelt, ["/work/app"], "opencode", ["acp"]).args;
    const profile = args[args.indexOf("-p") + 1] ?? "";
    expect(profile).toContain("(deny process-info*)");
    expect(profile).toContain("(allow process-info* (target same-sandbox))");
    expect(profile).toContain('(deny sysctl-read (sysctl-name-prefix "kern.procargs"))');
    expect(profile.indexOf("(deny process-info*)")).toBeGreaterThan(profile.indexOf("(allow default)"));
    expect(profile.indexOf("(allow process-info* (target same-sandbox))")).toBeGreaterThan(
      profile.indexOf("(deny process-info*)"),
    );
  });

  it.runIf(canApplySeatbelt && existsSync("/usr/bin/python3"))(
    "stops a Seatbelt-wrapped process from reading the arguments and environment of one outside, not of its own child",
    async () => {
      const reader = join(import.meta.dirname, "..", "fixtures", "stand-in-sysctl-reader.py");
      const marker = `stand-in-token-${process.pid}-${Date.now()}`;
      // A stand-in for the service, holding a token in its environment, and for a harness, holding one in its arguments.
      const outside = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60_000)", `mcp-url=/mcp/${marker}`], {
        env: { ...process.env, OUTLORE_TOKEN: marker },
        stdio: "ignore",
      });
      try {
        await waitFor(() => outside.pid !== undefined);
        const read = (command: string, args: ReadonlyArray<string>) =>
          spawnSync(command, [...args], { encoding: "utf8", timeout: 10_000 }).stdout.trim();
        const readerArgs = ["-I", reader, String(outside.pid), marker];
        // Control: outside any sandbox the stand-in is readable, so "hidden" below is the sandbox's doing.
        expect(read("/usr/bin/python3", readerArgs)).toBe("seen");
        const wrapped = wrappedCommandOf(seatbelt, [], "/usr/bin/python3", readerArgs);
        expect(read(wrapped.command, wrapped.args)).toBe("hidden");
        // Its own child stays readable: OpenCode may still look at what it started.
        const own = wrappedCommandOf(seatbelt, [], "/bin/sh", [
          "-c",
          `OUTLORE_TOKEN=own-${marker} "${process.execPath}" -e 'setTimeout(() => {}, 5000)' & sleep 1; /usr/bin/python3 -I "$0" $! own-${marker}`,
          reader,
        ]);
        expect(read(own.command, own.args)).toBe("seen");
      } finally {
        outside.kill("SIGKILL");
      }
    },
  );

  it("starts it under bubblewrap with the system read-only, its folders writable, and the network shared", () => {
    const wrapped = wrappedCommandOf(bwrap, ["/work/app", "/caches/bun"], "opencode", ["acp"]);
    expect(wrapped.command).toBe("/usr/bin/bwrap");
    expect(wrapped.args).toEqual([
      "--ro-bind",
      "/",
      "/",
      "--dev",
      "/dev",
      "--proc",
      "/proc",
      "--tmpfs",
      "/tmp",
      "--bind",
      "/work/app",
      "/work/app",
      "--bind",
      "/caches/bun",
      "/caches/bun",
      "--share-net",
      "--unshare-pid",
      "--die-with-parent",
      "--",
      "opencode",
      "acp",
    ]);
  });

  it("keeps all of OpenCode's folders, its data included, in the service's own folder, one data copy per account", () => {
    const work = openCodeEnvironmentOf(seatbelt, "/accounts/work");
    expect(work).toEqual({
      TMPDIR: "/state/opencode/tmp",
      XDG_CACHE_HOME: "/state/opencode/cache",
      XDG_CONFIG_HOME: "/state/opencode/config",
      XDG_DATA_HOME: sandboxDataHomeOf(seatbelt, "/accounts/work"),
      XDG_STATE_HOME: "/state/opencode/state",
    });
    expect(work.XDG_DATA_HOME.startsWith("/state/opencode/data/")).toBe(true);
    // Never the account's own folder, nor the computer's, which OpenCode runs outside the sandbox read.
    const computer = openCodeEnvironmentOf(seatbelt, null).XDG_DATA_HOME;
    expect(computer).toBe("/state/opencode/data/computer");
    expect([computer, work.XDG_DATA_HOME]).not.toContain("/accounts/work");
    expect(computer).not.toBe(seatbelt.computerDataHome);
    // Accounts do not share a copy.
    expect(sandboxDataHomeOf(seatbelt, "/accounts/home")).not.toBe(work.XDG_DATA_HOME);
  });

  it("lets it write its workspace, the service's folders, its own data copy, and the caches, never the real data", () => {
    const root = directory();
    const sandbox: OpenCodeSandbox = {
      ...seatbelt,
      caches: [],
      computerDataHome: join(root, "share"),
      root: join(root, "state"),
    };
    const roots = writableRootsOf(sandbox, join(root, "work"), join(root, "accounts", "work"));
    const copy = sandboxDataHomeOf(sandbox, join(root, "accounts", "work"));
    expect(roots).toEqual([
      join(root, "work"),
      join(root, "state", "tmp"),
      join(root, "state", "cache"),
      join(root, "state", "config"),
      join(root, "state", "state"),
      copy,
    ]);
    for (const real of [join(root, "accounts", "work"), join(root, "share"), join(root, "state")])
      expect(roots.some((path) => path === real || real.startsWith(`${path}/`))).toBe(false);
    expect(statSync(copy).mode & 0o777).toBe(0o700);
    expect(writableRootsOf(sandbox, join(root, "work"), null)).toContain(sandboxDataHomeOf(sandbox, null));
  });

  it("never lets a link planted in place of one of its folders widen what it may write", () => {
    const root = directory();
    const sandbox: OpenCodeSandbox = { ...seatbelt, caches: [], root: join(root, "state") };
    writableRootsOf(sandbox, join(root, "work"), null);
    rmSync(join(root, "state", "tmp"), { recursive: true });
    symlinkSync(root, join(root, "state", "tmp"));
    const roots = writableRootsOf(sandbox, join(root, "work"), null);
    expect(roots).toContain(join(root, "state", "tmp"));
    expect(roots).not.toContain(root);
    expect(lstatSync(join(root, "state", "tmp")).isSymbolicLink()).toBe(false);
  });

  it("gives the sandbox every writable folder by its real path, even when reached through a link", () => {
    const root = directory();
    mkdirSync(join(root, "real"));
    symlinkSync(join(root, "real"), join(root, "via"));
    mkdirSync(join(root, "cache"));
    symlinkSync(join(root, "cache"), join(root, "cache-link"));
    const sandbox: OpenCodeSandbox = {
      ...seatbelt,
      caches: [join(root, "cache-link")],
      root: join(root, "via", "state"),
    };
    const roots = writableRootsOf(sandbox, join(root, "via", "work"), null);
    expect(roots.length).toBeGreaterThan(0);
    for (const path of roots) {
      expect(realpathSync(path)).toBe(path);
      expect(path.startsWith(join(root, "via"))).toBe(false);
    }
    expect(roots).toContain(join(root, "cache"));
  });

  it("has no sandbox when the host's sandbox cannot run, or its tool is missing", () => {
    expect(
      detectOpenCodeSandbox({ platform: "darwin", root: "/s", sandboxProblem: "Sandbox unavailable." }),
    ).toBeNull();
    expect(detectOpenCodeSandbox({ platform: "win32", root: "/s", sandboxProblem: null })).toBeNull();
    expect(
      detectOpenCodeSandbox({ platform: "linux", root: "/s", sandboxProblem: null, which: () => null }),
    ).toBeNull();
    expect(
      detectOpenCodeSandbox({
        platform: "linux",
        probe: () => true,
        root: "/s",
        sandboxProblem: null,
        which: () => "/usr/bin/bwrap",
      }),
    ).toMatchObject({ command: "/usr/bin/bwrap", kind: "bwrap" });
    expect(
      detectOpenCodeSandbox({
        platform: "linux",
        probe: () => false,
        root: "/s",
        sandboxProblem: null,
        which: () => "/usr/bin/bwrap",
      }),
    ).toBeNull();
  });

  it.skipIf(!canApplySeatbelt)("confines writes on this Mac: inside the roots only, never through a link out", () => {
    const root = directory();
    const inside = join(root, "inside");
    const outside = join(root, "outside");
    mkdirSync(inside);
    mkdirSync(outside);
    symlinkSync(outside, join(inside, "escape"));
    const wrapped = wrappedCommandOf({ ...seatbelt, caches: [] }, [inside], process.execPath, [
      join(import.meta.dirname, "..", "fixtures", "stand-in-write-probe.mjs"),
      "plain",
      join(inside, "a"),
      join(outside, "b"),
      join(inside, "escape", "c"),
    ]);
    const run = spawnSync(wrapped.command, wrapped.args, { encoding: "utf8" });
    expect(JSON.parse(run.stdout)).toEqual(["ok", "EPERM", "EPERM"]);
    expect(existsSync(join(outside, "b"))).toBe(false);
  });
});

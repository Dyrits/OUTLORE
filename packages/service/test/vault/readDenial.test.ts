import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { vaultProfileArgsOf, vaultProfileName } from "../../src/harness/codexVaultProfile.ts";
import { wrappedCommandOf } from "../../src/harness/openCodeSandbox.ts";
import { judgeDenial, probeMarkerName, probeVaultDenial, type RunCommand } from "../../src/harness/vaultDenial.ts";
import {
  readClaudeVaultDenial,
  readCodexVaultDenial,
  readOpenCodeVaultDenial,
} from "../../src/harness/vaultDenials.ts";
import { temporary } from "../fixtures/service.ts";
import { seatbelt, seatbeltIn } from "../fixtures/standIns.ts";
import { canApplySeatbelt } from "../support/environment.ts";

const read = (stdout: string, code: number | null = 0) => ({ code, output: stdout, stdout });
const secrets = { control: "control-text", marker: "marker-text" };

describe("judging a probe of a harness's denial of the Vault's folder", () => {
  const reads = {
    insideControl: read(secrets.control),
    insideMarker: read("", 1),
    outside: read(secrets.marker),
  };

  it("verifies a clean denial beside controls that read", () => {
    expect(judgeDenial("codex", reads, secrets)).toMatchObject({ harness: "codex", status: "Verified" });
  });

  it("fails closed when the marker is readable inside the sandbox", () => {
    expect(judgeDenial("codex", { ...reads, insideMarker: read(secrets.marker) }, secrets)).toMatchObject({
      reason: "A command inside its sandbox could read the Vault's folder.",
      status: "Unverified",
    });
  });

  it("fails closed when the outside control could not read the marker, so a denial would prove nothing", () => {
    expect(judgeDenial("codex", { ...reads, outside: read("", 1) }, secrets).status).toBe("Unverified");
  });

  it("fails closed when the sandbox ran nothing, since a command that never started is not a denial", () => {
    expect(judgeDenial("codex", { ...reads, insideControl: read("", 71) }, secrets).status).toBe("Unverified");
  });

  it("fails closed when the marker's read exited cleanly but showed nothing", () => {
    expect(judgeDenial("codex", { ...reads, insideMarker: read("", 0) }, secrets).status).toBe("Unverified");
  });
});

describe("probing with a fake runner", () => {
  /** Reads a file as `cat` does, so the probe's marker and control are really there; `hidden` fails the marker. */
  const catting =
    (isHidden: boolean): RunCommand =>
    (command, args) =>
      Effect.sync(() => {
        const path = args.at(-1) ?? "";
        if (isHidden && path.endsWith(probeMarkerName) && command !== "/bin/cat") return read("", 1);
        const found = spawnSync("/bin/cat", [path], { encoding: "utf8" });
        return read(found.stdout, found.status);
      });
  const wrap = (path: string) => ({ args: ["wrapped", path], command: "stand-in" });

  it.effect("verifies when the wrapped marker read fails and removes its marker afterwards", () =>
    Effect.gen(function* () {
      const folder = join(temporary("outlore-probe-"), "vault");
      expect((yield* probeVaultDenial("opencode", folder, wrap, catting(true))).status).toBe("Verified");
      expect(readdirSync(folder)).toEqual([]);
    }),
  );

  it.effect("fails closed when the wrapped read shows the marker, and when no sandbox can run", () =>
    Effect.gen(function* () {
      const folder = join(temporary("outlore-probe-"), "vault");
      expect((yield* probeVaultDenial("opencode", folder, wrap, catting(false))).status).toBe("Unverified");
      expect((yield* probeVaultDenial("opencode", folder, () => null, catting(true))).reason).toBe(
        "Its sandbox cannot run here.",
      );
    }),
  );
});

describe("a harness that is not installed, or whose sandbox cannot be tried at start", () => {
  const run =
    (code: number | null): RunCommand =>
    () =>
      Effect.succeed(read("", code));

  it.effect(
    "says Claude Code's denial is unverified, for want of a probe that needs no model, or that it is not installed",
    () =>
      Effect.gen(function* () {
        expect(yield* readClaudeVaultDenial({ command: "claude", run: run(0) }, "claude")).toMatchObject({
          status: "Unverified",
        });
        expect(yield* readClaudeVaultDenial({ command: "claude", run: run(null) }, "claude")).toMatchObject({
          status: "NotInstalled",
        });
      }),
  );

  it.effect("says Codex is not installed when its command does not start", () =>
    Effect.gen(function* () {
      expect(yield* readCodexVaultDenial({ command: "codex", run: run(null) }, "codex", "/nowhere")).toMatchObject({
        status: "NotInstalled",
      });
    }),
  );

  it.effect("says OpenCode asks first about every action when it runs in no sandbox here", () =>
    Effect.gen(function* () {
      expect(
        yield* readOpenCodeVaultDenial({ command: "opencode", run: run(0), sandbox: null }, "opencode", "/nowhere"),
      ).toMatchObject({ status: "AsksFirst" });
    }),
  );
});

/** A folder standing for the Vault, with a marker whose text a sandboxed read must not show, and a file beside it. */
const vaultWithMarker = () => {
  const root = realpathSync(temporary("outlore-denial-"));
  const folder = join(root, "vault");
  mkdirSync(folder, { mode: 0o700 });
  const marker = `marker-${process.pid}-${Date.now()}`;
  writeFileSync(join(folder, "marker"), marker);
  writeFileSync(join(root, "control"), "control");
  return { control: join(root, "control"), folder, marker, root };
};
const run = (command: string, args: ReadonlyArray<string>) =>
  spawnSync(command, [...args], { encoding: "utf8", timeout: 20_000 });

describe.skipIf(!canApplySeatbelt)("OpenCode's Seatbelt profile and the Vault's folder", () => {
  it("lets the outside read the marker and stops the wrapped process from reading or listing the folder", () => {
    const { control, folder, marker } = vaultWithMarker();
    const hidden = { ...seatbelt, hidden: [folder] };
    const inside = (command: string, args: ReadonlyArray<string>) => {
      const wrapped = wrappedCommandOf(hidden, [], command, args);
      return run(wrapped.command, wrapped.args);
    };
    // The outside control: without it, a refusal would prove nothing.
    expect(run("/bin/cat", [join(folder, "marker")]).stdout).toBe(marker);
    expect(inside("/bin/cat", [control]).stdout).toBe("control");
    const denied = inside("/bin/cat", [join(folder, "marker")]);
    expect(denied.stdout).toBe("");
    expect(denied.stderr).toContain("Operation not permitted");
    expect(inside("/bin/ls", [folder]).stdout).toBe("");
    expect(inside("/bin/sh", ["-c", `echo planted > ${join(folder, "planted")}`]).status).not.toBe(0);
    expect(existsSync(join(folder, "planted"))).toBe(false);
  });

  it("reads the marker when the profile hides nothing, so the test can fail", () => {
    const { folder, marker } = vaultWithMarker();
    const wrapped = wrappedCommandOf({ ...seatbelt, hidden: [] }, [], "/bin/cat", [join(folder, "marker")]);
    expect(run(wrapped.command, wrapped.args).stdout).toBe(marker);
  });

  it.effect("is verified by the adapter's probe, and unverified when the folder is not hidden", () =>
    Effect.gen(function* () {
      const { folder } = vaultWithMarker();
      const real = realpathSync(temporary("outlore-real-"));
      const sandbox = seatbeltIn(real)(temporary("outlore-state-"));
      const options = { command: "/usr/bin/true", sandbox: { ...sandbox, hidden: [folder] } };
      expect(yield* readOpenCodeVaultDenial(options, "opencode", folder)).toMatchObject({ status: "Verified" });
      expect(
        yield* readOpenCodeVaultDenial({ ...options, sandbox: { ...sandbox, hidden: [] } }, "opencode", folder),
      ).toMatchObject({ reason: "A command inside its sandbox could read the Vault's folder.", status: "Unverified" });
      expect(readdirSyncSafe(folder)).toEqual(["marker"]);
    }),
  );
});

const readdirSyncSafe = (folder: string) => readdirSync(folder).sort();

const hasCodex = canApplySeatbelt && spawnSync("codex", ["--version"], { timeout: 20_000 }).status === 0;

describe.skipIf(!hasCodex)("Codex's permission profile and the Vault's folder", () => {
  it("lets the outside read the marker and stops `codex sandbox` under the Outlore profile, not under :workspace alone", () => {
    const { control, folder, marker, root } = vaultWithMarker();
    const insideProfile = (name: string, extra: ReadonlyArray<string>, command: string, args: ReadonlyArray<string>) =>
      run("codex", ["sandbox", "-C", root, "-P", name, ...extra, "--", command, ...args]);
    expect(run("/bin/cat", [join(folder, "marker")]).stdout).toBe(marker);
    // Control: the built-in profile, with no denial, reads it; so the denial below is the profile's doing.
    expect(insideProfile(":workspace", [], "/bin/cat", [join(folder, "marker")]).stdout).toBe(marker);
    expect(insideProfile(vaultProfileName, vaultProfileArgsOf(folder), "/bin/cat", [control]).stdout).toBe("control");
    const denied = insideProfile(vaultProfileName, vaultProfileArgsOf(folder), "/bin/cat", [join(folder, "marker")]);
    expect(denied.stdout).toBe("");
    expect(denied.stderr).toContain("Operation not permitted");
  });

  it("keeps what workspace-write allows: the folder, /tmp and the temporary folder written, the home folder not, the network open", () => {
    const { folder, root } = vaultWithMarker();
    const script = join(root, "writes.sh");
    writeFileSync(
      script,
      `for target in "$PWD/inside" /tmp/outlore-denial-w "$HOME/outlore-denial-w"; do if (echo x > "$target") 2>/dev/null; then echo "$target yes"; rm -f "$target"; else echo "$target no"; fi; done`,
    );
    const answer = run("codex", [
      "sandbox",
      "-C",
      root,
      "-P",
      vaultProfileName,
      ...vaultProfileArgsOf(folder),
      "--",
      "/bin/sh",
      script,
    ]).stdout;
    expect(answer).toContain(`${root}/inside yes`);
    expect(answer).toContain("/tmp/outlore-denial-w yes");
    expect(answer).toMatch(/outlore-denial-w no/);
  });

  it.effect("is verified by the adapter's probe", () =>
    Effect.gen(function* () {
      const { folder } = vaultWithMarker();
      expect(yield* readCodexVaultDenial({ command: "codex" }, "codex", folder)).toMatchObject({ status: "Verified" });
    }),
  );
});

describe.skipIf(!canApplySeatbelt)("the macOS Keychain from inside a sandbox (why it is no second layer)", () => {
  const canWriteKeychain = (() => {
    const service = `outlore-denial-probe-${process.pid}`;
    const added = spawnSync("/usr/bin/security", ["-i"], {
      encoding: "utf8",
      input: `add-generic-password -a outlore-test -s ${service} -w x -U\n`,
    });
    spawnSync("/usr/bin/security", ["delete-generic-password", "-s", service]);
    return added.status === 0;
  })();

  it.skipIf(!canWriteKeychain)(
    "is read from inside OpenCode's profile as from outside, with `security` and `security -i`",
    () => {
      const service = `outlore-denial-probe-${process.pid}-${Date.now()}`;
      const secret = `disposable-${Date.now()}`;
      try {
        spawnSync("/usr/bin/security", ["-i"], {
          encoding: "utf8",
          input: `add-generic-password -a outlore-test -s ${service} -w ${secret} -U\n`,
        });
        const outside = run("/usr/bin/security", ["find-generic-password", "-s", service, "-w"]);
        expect(outside.stdout.trim()).toBe(secret);
        const wrapped = wrappedCommandOf({ ...seatbelt, hidden: [] }, [], "/usr/bin/security", [
          "find-generic-password",
          "-s",
          service,
          "-w",
        ]);
        expect(run(wrapped.command, wrapped.args).stdout.trim()).toBe(secret);
      } finally {
        spawnSync("/usr/bin/security", ["delete-generic-password", "-s", service]);
      }
    },
  );
});

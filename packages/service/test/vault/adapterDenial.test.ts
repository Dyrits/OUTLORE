import { readFileSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { accessArgsOf, sandboxSettingsOf } from "../../src/harness/claudeArgs.ts";
import { vaultProfileConfigOf } from "../../src/harness/codexVaultProfile.ts";
import { detectOpenCodeSandbox, wrappedCommandOf } from "../../src/harness/openCodeSandbox.ts";
import { makeCodexHarness } from "../../src/index.ts";
import { temporary } from "../fixtures/service.ts";
import { bwrap, seatbelt } from "../fixtures/standIns.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

const vault = "/data/vault";

describe("hiding the Vault's folder in Claude Code's sandbox", () => {
  it("denies reading the folder to commands, beside the writes it already allows", () => {
    const settings = sandboxSettingsOf(["/work/tree"], vault);
    expect(settings.sandbox.filesystem.denyRead).toEqual([vault]);
    expect(settings.sandbox.filesystem.allowWrite).toContain("/work/tree");
    expect(settings.sandbox.enabled).toBe(true);
  });

  it("sets no denial when there is no Vault to hide, as in checks", () => {
    expect(sandboxSettingsOf([], null).sandbox.filesystem).not.toHaveProperty("denyRead");
  });

  it("puts the folder in the arguments, so a changed folder restarts the kept process", () => {
    const { access } = turnRequestOf();
    const argsOf = (vaultFolder?: string) =>
      JSON.stringify(
        accessArgsOf(
          access,
          "context",
          { sandboxProblem: null, ...(vaultFolder === undefined ? {} : { vaultFolder }) },
          [],
        ),
      );
    // The settings travel as one JSON string argument, so their quotes are escaped in the list's JSON.
    expect(argsOf(vault)).toContain(`denyRead\\":[\\"${vault}\\"]`);
    expect(argsOf(vault)).not.toBe(argsOf("/other/vault"));
    expect(argsOf(vault)).not.toBe(argsOf());
  });
});

describe("hiding the Vault's folder in Codex's sandbox", () => {
  it("defines a profile on the built-in workspace one, with the folder denied and the network open", () => {
    expect(vaultProfileConfigOf(vault)).toEqual({
      "permissions.outlore.extends": ":workspace",
      "permissions.outlore.filesystem": { [vault]: "deny" },
      "permissions.outlore.network": { enabled: true },
    });
  });

  const startedWith = (vaultFolder?: string) =>
    Effect.gen(function* () {
      const log = join(temporary("outlore-codex-"), "log.jsonl");
      process.env.STAND_IN_LOG = log;
      const harness = yield* makeCodexHarness({
        command: process.execPath,
        idleTimeout: "10 minutes",
        prefixArgs: [join(import.meta.dirname, "..", "fixtures", "stand-in-codex.mjs")],
        ...(vaultFolder === undefined ? {} : { vaultFolder }),
      });
      yield* harness.runTurn(turnRequestOf({ harness: "codex" }));
      const lines = readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      return lines.find((entry) => entry.method === "thread/start")?.params;
    }).pipe(Effect.scoped);

  it.live("starts a thread on the named profile instead of workspace-write, never both", () =>
    Effect.gen(function* () {
      const params = yield* startedWith(vault);
      expect(params.permissions).toBe("outlore");
      expect(params).not.toHaveProperty("sandbox");
      expect(params.config).toMatchObject(vaultProfileConfigOf(vault));
      expect(JSON.stringify(params)).not.toContain("danger-full-access");
    }),
  );

  it.live("keeps workspace-write when there is no Vault to hide", () =>
    Effect.gen(function* () {
      const params = yield* startedWith();
      expect(params.sandbox).toBe("workspace-write");
      expect(params).not.toHaveProperty("permissions");
    }),
  );
});

describe("hiding the Vault's folder in OpenCode's sandbox", () => {
  const profileOf = (args: ReadonlyArray<string>) => args[args.indexOf("-p") + 1] ?? "";

  it("denies reading the folder in the Seatbelt profile after every allow, the path passed as a parameter", () => {
    const wrapped = wrappedCommandOf({ ...seatbelt, hidden: [vault] }, ["/work/app"], "opencode", ["acp"]);
    expect(wrapped.args).toContain(`H0=${vault}`);
    const profile = profileOf(wrapped.args);
    expect(profile).toContain('(deny file-read* (subpath (param "H0")))');
    expect(profile.indexOf("(deny file-read*")).toBeGreaterThan(profile.indexOf("(allow file-write*"));
    expect(profile).not.toContain(vault);
  });

  it("adds no read rule when nothing is hidden", () => {
    expect(profileOf(wrappedCommandOf(seatbelt, ["/work/app"], "opencode", ["acp"]).args)).not.toContain("file-read*");
  });

  it("covers the folder with an empty one in bubblewrap, after the writable binds", () => {
    const { args } = wrappedCommandOf({ ...bwrap, hidden: [vault] }, ["/work/app"], "opencode", ["acp"]);
    expect(args.slice(args.indexOf("--tmpfs", args.indexOf("--bind")))).toEqual([
      "--tmpfs",
      vault,
      "--share-net",
      "--unshare-pid",
      "--die-with-parent",
      "--",
      "opencode",
      "acp",
    ]);
  });

  it("makes the hidden folder, mode 0700, and names it by its real path", () => {
    const folder = join(temporary("outlore-hidden-"), "vault");
    const sandbox = detectOpenCodeSandbox({
      hidden: [folder],
      platform: "darwin",
      probe: () => true,
      root: temporary("outlore-root-"),
      sandboxProblem: null,
    });
    expect(statSync(folder).mode & 0o777).toBe(0o700);
    expect(sandbox?.hidden).toEqual([realpathSync(folder)]);
  });
});

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "@effect/vitest";
import { gitGrantsOf } from "../../src/harness/codexGitGrants.ts";
import { vaultProfileArgsOf, vaultProfileConfigOf, vaultProfileName } from "../../src/harness/codexVaultProfile.ts";
import { temporary } from "../fixtures/service.ts";
import { canApplySeatbelt } from "../support/environment.ts";

const git = (cwd: string, ...args: ReadonlyArray<string>) =>
  spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "protocol.file.allow=always", ...args], {
    cwd,
    encoding: "utf8",
  });

const repository = (parent: string) => {
  const root = join(parent, "repo");
  mkdirSync(root);
  git(root, "init", "-q");
  writeFileSync(join(root, "f"), "a");
  git(root, "add", "f");
  git(root, "commit", "-qm", "first");
  return realpathSync(root);
};

describe("the Git grants of Codex's permission profile (ADR 0025)", () => {
  it("grants nothing outside a repository", () => {
    expect(gitGrantsOf(realpathSync(temporary("outlore-no-git-")))).toEqual({});
  });

  it("writes the Git folder from a subfolder, and keeps its hooks and config read-only", () => {
    const root = repository(temporary("outlore-git-"));
    mkdirSync(join(root, "sub"));
    expect(gitGrantsOf(join(root, "sub"))).toEqual({
      [join(root, ".git")]: "write",
      [join(root, ".git", "hooks")]: "read",
      [join(root, ".git", "config")]: "read",
    });
  });

  it("writes a linked worktree's folder and the shared one, and keeps the hooks and config of both read-only", () => {
    const root = repository(temporary("outlore-git-"));
    const worktree = join(realpathSync(temporary("outlore-worktree-")), "tree");
    git(root, "worktree", "add", "-q", worktree, "-b", "side");
    const own = join(root, ".git", "worktrees", "tree");
    expect(gitGrantsOf(worktree)).toEqual({
      [own]: "write",
      [join(root, ".git")]: "write",
      [join(own, "hooks")]: "read",
      [join(own, "config")]: "read",
      [join(root, ".git", "hooks")]: "read",
      [join(root, ".git", "config")]: "read",
    });
  });

  it("keeps a submodule's hooks and config read-only too", () => {
    const parent = realpathSync(temporary("outlore-git-"));
    const library = join(parent, "library");
    mkdirSync(library);
    git(library, "init", "-q");
    writeFileSync(join(library, "l"), "l");
    git(library, "add", "l");
    git(library, "commit", "-qm", "first");
    const root = repository(parent);
    git(root, "submodule", "add", "-q", library, "lib");
    const module = join(root, ".git", "modules", "lib");
    expect(existsSync(module)).toBe(true);
    expect(gitGrantsOf(root)).toMatchObject({
      [join(module, "hooks")]: "read",
      [join(module, "config")]: "read",
    });
  });

  it("keeps Git rules read-only for multi-component and nested submodule names", () => {
    const root = realpathSync(temporary("outlore-git-"));
    const shared = join(root, ".git");
    const library = join(shared, "modules", "vendor", "shared", "library");
    const nested = join(library, "modules", "tools", "format");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(library, "HEAD"), "ref: refs/heads/main\n");
    writeFileSync(join(nested, "HEAD"), "ref: refs/heads/main\n");

    const profile = vaultProfileConfigOf(null, gitGrantsOf(root));

    expect(profile[`permissions.${vaultProfileName}.filesystem`]).toEqual({
      [shared]: "write",
      [join(shared, "hooks")]: "read",
      [join(shared, "config")]: "read",
      [join(library, "hooks")]: "read",
      [join(library, "config")]: "read",
      [join(nested, "hooks")]: "read",
      [join(nested, "config")]: "read",
    });
  });
});

const hasCodex = canApplySeatbelt && spawnSync("codex", ["--version"], { timeout: 20_000 }).status === 0;
// Not under /tmp or the temporary folder, which the profile writes anyway, so a write to `.git` proves the grant.
const home = hasCodex ? mkdtempSync(join(homedir(), ".outlore-codex-git-")) : "";
afterAll(() => {
  if (home !== "") rmSync(home, { force: true, recursive: true });
});

describe.skipIf(!hasCodex)("`codex sandbox` under the Git grants", () => {
  const inside = (root: string, grants: boolean, script: string) =>
    spawnSync(
      "codex",
      [
        "sandbox",
        "-C",
        root,
        "-P",
        vaultProfileName,
        ...vaultProfileArgsOf(null, grants ? gitGrantsOf(root) : { [join(root, "x")]: "write" }),
        "--",
        "/bin/sh",
        "-c",
        script,
      ],
      { encoding: "utf8", timeout: 30_000 },
    );

  it("cannot create the index lock without the grants, and can with them", () => {
    const root = repository(mkdtempSync(join(home, "case-")));
    expect(inside(root, false, "touch .git/index.lock").stderr).toContain("Operation not permitted");
    expect(inside(root, true, "touch .git/index.lock && rm .git/index.lock && echo ok").stdout).toContain("ok");
  });

  it("stages and commits, and cannot plant a hook or change the config", () => {
    const root = repository(mkdtempSync(join(home, "case-")));
    const committed = inside(
      root,
      true,
      "echo b > g && git add g && git -c user.name=t -c user.email=t@t commit -qm m && echo done",
    );
    expect(committed.stdout).toContain("done");
    expect(inside(root, true, "echo x > .git/hooks/pre-commit").stderr).toContain("Operation not permitted");
    expect(inside(root, true, "echo x >> .git/config").stderr).toContain("Operation not permitted");
  });
});

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

// guard-git.py decides, from a shell command on stdin, whether a human must confirm it (exit 2) or it passes (exit 0).
// The agent harnesses run it at level 2 (.claude/settings.json, .codex/hooks.json, .gemini/settings.json).

const script = join(dirname(fileURLToPath(import.meta.url)), "guard-git.py");
const folder = mkdtempSync(join(tmpdir(), "guard-git-"));
afterAll(() => rmSync(folder, { force: true, recursive: true }));

function exitOf(command: string, level = 2): number | null {
  return spawnSync("python3", ["-I", script, "--level", String(level), "--cwd", folder], { input: command }).status;
}

describe("guard-git.py at level 2", () => {
  it.each([
    "git push origin main",
    "git push origin HEAD:main",
    "git push origin +main",
    "git push origin :feature",
    "git push --delete origin feature",
    "git push --force origin feature",
    "git push --no-verify origin feature",
    "git -C elsewhere push origin main",
    'bash -c "git push origin main"',
    "git reset --hard",
    "git clean -fd",
    "git branch -D feature",
  ])("asks before `%s`", (command) => {
    expect(exitOf(command)).toBe(2);
  });

  it.each([
    "git push origin feature",
    "git push --force-with-lease origin feature",
    "git push --dry-run origin main",
    "git status",
    'git commit -m "message"',
    "git commit --amend",
    "git branch feature",
    "git branch -d feature",
  ])("lets `%s` pass", (command) => {
    expect(exitOf(command)).toBe(0);
  });

  // ST-H-04: commands that skip the repository's own gates or move work off its commits
  it.each([
    "git commit --no-verify -m message",
    "git commit -n -m message",
    "git commit -nm message",
    "git commit -am message --no-verify",
    "git -c core.hooksPath=/dev/null commit -m message",
    "git -c core.hooksPath=/dev/null push origin feature",
    "git -ccore.hooksPath=/dev/null commit -m message",
    "git --config-env=core.hooksPath=HOOKS commit -m message",
    "git branch -f feature HEAD~3",
    "git branch --force feature HEAD~3",
    "git rm -f file.txt",
    "git merge --abort",
    "git update-ref -d refs/heads/feature",
  ])("asks before `%s`", (command) => {
    expect(exitOf(command)).toBe(2);
  });

  it.each([
    "B=main; git push origin $B",
    'git push origin "$(git branch --show-current)"',
    "git push origin $(git branch --show-current)",
    'git push origin "`git branch --show-current`"',
    `git push origin "refs/heads/\${BRANCH}"`,
  ])("asks before a push whose ref is an expansion: `%s`", (command) => {
    expect(exitOf(command)).toBe(2);
  });

  it.each(['echo "git push origin main" | sh', 'echo "git push origin main" | bash -s', "sh < script.sh"])(
    "asks before a shell that reads its commands from stdin: `%s`",
    (command) => {
      expect(exitOf(command)).toBe(2);
    },
  );

  it.each([
    "bash script.sh",
    'bash -c "git status"',
    "git commit -m 'no-verify is a word'",
    "git -c user.name=x commit -m m",
  ])("lets `%s` pass", (command) => {
    expect(exitOf(command)).toBe(0);
  });
});

describe("guard-git.py at level 1", () => {
  it("still asks before a push to the protected branch, and lets a commit with the hook skipped pass", () => {
    expect(exitOf("git push origin main", 1)).toBe(2);
    expect(exitOf("git commit --no-verify -m message", 1)).toBe(0);
  });
});

describe("OpenCode's Git permissions", () => {
  // OpenCode's shell rules are glob patterns; the last matching rule wins.
  function permissionOf(command: string): string | undefined {
    const config = JSON.parse(readFileSync(join(dirname(script), "..", "..", "opencode.json"), "utf8"));
    return Object.entries<string>(config.permission.bash).reduce<string | undefined>((decision, [glob, action]) => {
      const pattern = glob
        .split("*")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*");
      return new RegExp(`^${pattern}$`).test(command) ? action : decision;
    }, undefined);
  }

  it.each([
    "git -C elsewhere push origin main",
    "git -c core.hooksPath=/dev/null commit -m x",
    "git commit --no-verify -m x",
    "git commit -nm message",
    "git branch -f feature HEAD~3",
  ])("asks before `%s`", (command) => {
    expect(permissionOf(command)).toBe("ask");
  });

  it("keeps the dry-run push exception", () => {
    expect(permissionOf("git push --dry-run origin main")).toBe("allow");
  });
});

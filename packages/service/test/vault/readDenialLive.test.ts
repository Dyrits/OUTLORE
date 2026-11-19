import { spawnSync } from "node:child_process";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { sandboxSettingsOf } from "../../src/harness/claudeArgs.ts";
import { temporary } from "../fixtures/service.ts";

// The one probe that needs a live model: Claude Code applies its sandbox only inside a turn, and no command of its own
// runs a command under it without one. It is opt-in, since it spends a few cents of the owner's own Claude account:
//   OUTLORE_LIVE_CLAUDE_PROBE=1 TMPDIR=<a folder with no space> bun run test packages/service/test/vault/readDenialLive
// It uses a disposable marker and control file, stores no secret, and runs Claude Code with the very sandbox settings the
// adapter gives a thread (`sandboxSettingsOf`), once with the Vault's folder denied and once without (the control that
// shows the probe can fail). Run from the owner's terminal: inside a thread's own sandbox Claude Code cannot start one.
const isLive = process.env.OUTLORE_LIVE_CLAUDE_PROBE === "1";

describe.skipIf(!isLive)("Claude Code's sandbox and the Vault's folder, in a live turn", () => {
  const setup = () => {
    const root = realpathSync(temporary("outlore-live-"));
    const folder = join(root, "vault");
    mkdirSync(folder, { mode: 0o700 });
    const marker = `marker-${process.pid}-${Date.now()}`;
    const control = `control-${process.pid}-${Date.now()}`;
    writeFileSync(join(folder, "marker"), marker);
    writeFileSync(join(root, "control"), control);
    return { control, controlPath: join(root, "control"), folder, marker, markerPath: join(folder, "marker"), root };
  };

  const answerOf = (root: string, vaultFolder: string | null, prompt: string) => {
    const run = spawnSync(
      process.env.OUTLORE_CLAUDE_PATH ?? "claude",
      [
        "-p",
        prompt,
        "--output-format",
        "json",
        "--permission-mode",
        "acceptEdits",
        "--settings",
        JSON.stringify(sandboxSettingsOf([], vaultFolder)),
        "--setting-sources",
        "",
        "--strict-mcp-config",
        "--max-budget-usd",
        "0.5",
      ],
      { cwd: root, encoding: "utf8", timeout: 180_000 },
    );
    return String(JSON.parse(run.stdout).result);
  };

  const promptOf = (controlPath: string, markerPath: string) =>
    `Run these two Bash commands one at a time and then reply with what each printed, word for word, or its error: first \`cat ${controlPath}\`, then \`cat ${markerPath}\`.`;

  it("reads the marker when the folder is not denied, which shows the probe can fail", () => {
    const { control, controlPath, marker, markerPath, root } = setup();
    const answer = answerOf(root, null, promptOf(controlPath, markerPath));
    expect(answer).toContain(control);
    expect(answer).toContain(marker);
  });

  it("does not read the marker with the folder denied, while the control file is read", () => {
    const { control, controlPath, folder, marker, markerPath, root } = setup();
    const answer = answerOf(root, folder, promptOf(controlPath, markerPath));
    expect(answer).toContain(control);
    expect(answer).not.toContain(marker);
  });
});
